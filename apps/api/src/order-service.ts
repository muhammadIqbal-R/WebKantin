import {createHash,randomBytes} from 'node:crypto';
import {CreateOrdersResponseSchema,OrderSchema,OrderItemSchema,OrderDetailResponseSchema,PaymentWindowSchema,type CreateOrdersRequest,type Order} from '@kantin/shared';
import type {Prisma,OrderRefund} from './generated/prisma/client.js';
import type {Database} from './database.js';
import {ReplayCipher} from './replay.js';
import {HttpError,databaseCode} from './errors.js';
import {refundDto} from './order-operations.js';
export const orderDto=(row:Prisma.OrderGetPayload<object>):Order=>OrderSchema.parse({id:row.id,order_code:row.orderCode,tenant_id:row.tenantId,customer_name:row.customerName,order_type:row.orderType,total:row.total,status:row.status,payment_status:row.paymentStatus,payment_method:row.paymentMethod,payment_confirmed_by:row.paymentConfirmedBy,payment_confirmed_at:row.paymentConfirmedAt?.toISOString()??null,version:row.version,created_at:row.createdAt.toISOString(),updated_at:row.updatedAt.toISOString()});
export const customerOrderDetail = {
  items: true,
  paymentWindow: true,
  refund: true,
  fulfillment: true,
  events: {
    where: { action: 'payment_rejected' },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 1,
    select: { reason: true },
  },
} satisfies Prisma.OrderInclude;
export function detailDto(row: Prisma.OrderGetPayload<{include:{items:true}}> & {
  events?: {reason:string|null}[];
  paymentSnapshots?: {merchantName:string}[];
  paymentWindow?: {deadlineAt:Date;expiredAt:Date|null}|null;
  refund?: OrderRefund|null;
  fulfillment?: {tableNumber:string|null;pickupNote:string|null}|null;
}, actor?: string) {
  const reason = row.paymentStatus === 'rejected' ? row.events?.[0]?.reason : null;
  const merchant = row.paymentSnapshots?.[0]?.merchantName;
  return OrderDetailResponseSchema.parse({
    data: orderDto(row),
    items: row.items.map(item => OrderItemSchema.parse({
      id:item.id,order_id:item.orderId,tenant_id:item.tenantId,menu_id:item.menuId,menu_name:item.menuName,
      qty:item.qty,unit_price:item.unitPrice,subtotal:item.subtotal,
    })),
    ...(reason ? {payment_rejection_reason:reason} : {}),
    ...(merchant ? {payment_merchant_name:merchant} : {}),
    chat_available: Boolean(row.customerId),
    payment_window: row.paymentWindow ? PaymentWindowSchema.parse({
      deadline_at:row.paymentWindow.deadlineAt.toISOString(),expired_at:row.paymentWindow.expiredAt?.toISOString() ?? null,
    }) : null,
    refund: row.refund ? refundDto(row.refund,actor) : null,
    refund_available: Boolean(row.customerId && (row.paymentStatus==='paid' || row.paymentWindow?.expiredAt)),
    ...(row.fulfillment ? {fulfillment:{table_number:row.fulfillment.tableNumber,pickup_note:row.fulfillment.pickupNote}} : {}),
  });
}
export async function checkout(db:Pick<Database,'checkout'>,cipher:ReplayCipher,sub:string,key:string,input:CreateOrdersRequest,requestId:string){
  cipher.assertReady();const items=[...input.items].sort((a,b)=>a.menu_id.localeCompare(b.menu_id)),hash=createHash('sha256').update(JSON.stringify({owner:sub,...input,items})).digest('hex');
  for(let attempt=0;attempt<3;attempt++){
    try{return await db.checkout(sub,key,hash,requestId,async tx=>{
      const existing=await tx.checkoutRequest.findUnique({where:{idempotencyKey:key}});
      if(existing){if(existing.customerId!==sub||existing.requestHash!==hash||existing.expiresAt<=new Date())throw new HttpError(409,'Kunci checkout tidak sesuai. Periksa pesanan sebelum mengulang.');if(!existing.responseCiphertext)throw new HttpError(409,'Checkout sedang diproses. Coba kembali.');return CreateOrdersResponseSchema.parse(cipher.decrypt(existing.responseCiphertext));}
      await tx.checkoutRequest.create({data:{idempotencyKey:key,requestHash:hash,customerId:sub}});
      const products=await tx.menu.findMany({where:{id:{in:items.map(item=>item.menu_id)},isActive:true,isAvailable:true,stock:{gt:0},tenant:{isActive:true,archivedAt:null,outlet:{isActive:true}}},include:{tenant:true}});
      if(products.length!==items.length)throw new HttpError(409,'Menu berubah atau habis. Periksa keranjang.');
      const groups=new Map<string,{menu:typeof products[number];qty:number}[]>();
      for(const item of items){const menu=products.find(product=>product.id===item.menu_id);if(!menu||menu.stock<item.qty||!menu.tenant.qrisImageUrl||!menu.tenant.qrisMerchantName)throw new HttpError(409,'Stok atau pembayaran tenant belum siap.');const group=groups.get(menu.tenantId)??[];group.push({menu,qty:item.qty});groups.set(menu.tenantId,group);}
      const orders=[];
      for(const [tenantId,lines] of [...groups.entries()].sort(([a],[b])=>a.localeCompare(b))){
        const total=lines.reduce((sum,line)=>sum+line.menu.price*line.qty,0);if(total>1_000_000_000)throw new HttpError(400,'Total pesanan melebihi batas.');
        const row=await tx.order.create({data:{tenantId,customerId:sub,customerName:input.customer_name,orderType:input.order_type,total}});
        if (input.table_number || input.pickup_note) {
          await tx.orderFulfillmentDetail.create({data:{
            orderId:row.id,tableNumber:input.table_number ?? null,pickupNote:input.pickup_note ?? null,
          }});
        }
        for(const {menu,qty} of lines)await tx.orderItem.create({data:{orderId:row.id,tenantId,menuId:menu.id,menuName:menu.name,qty,unitPrice:menu.price,subtotal:menu.price*qty}});
        const token=randomBytes(32).toString('base64url');await tx.orderAccessGrant.create({data:{orderId:row.id,tenantId,tokenDigest:createHash('sha256').update(token).digest('hex')}});
        const snapshot=await tx.orderPaymentSnapshot.findUniqueOrThrow({where:{orderId:row.id}});
        orders.push({order:orderDto(row),order_access_token:token,qris:{image_url:snapshot.qrisImageUrl,merchant_name:snapshot.merchantName}});
      }
      const response=CreateOrdersResponseSchema.parse({orders});await tx.checkoutRequest.update({where:{idempotencyKey:key},data:{responseCiphertext:cipher.encrypt(response)}});return response;
    });}catch(error:unknown){const code=databaseCode(error);if(attempt<2&&['P2002','P2034','40001','40P01','23505'].includes(code))continue;throw error;}
  }
  throw new HttpError(409,'Checkout sedang berubah. Periksa pesanan lalu coba kembali.');
}
