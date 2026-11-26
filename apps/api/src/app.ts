import express, { type Request, type Response, type NextFunction, type Express } from 'express';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import {
  ApiErrorSchema, CreateTenantAccountRequestSchema, CreateTenantRequestSchema, EmptyBodySchema,
  IdParamsSchema, ManagementQuerySchema, ManagedMenuCreateSchema, ManagedMenuPatchSchema,
  ManagedMenuSchema, ManagedMenusResponseSchema, ManagedTenantPatchSchema, ManagedTenantSchema,
  ManagedTenantsResponseSchema, ManagedUsersQuerySchema, ManagedUsersResponseSchema, MeResponseSchema,
  NameSchema, OutletListResponseSchema, PaginationQuerySchema, StockUpdateSchema, UserStatusSchema, type User,
  UploadQuerySchema, UploadResponseSchema, TenantListQuerySchema, TenantParamsSchema, TenantListResponseSchema,
  VendorImportRequestSchema,VendorImportResponseSchema,VENDOR_CATALOG,ExistingTenantAccountSchema,
  CreateOrdersRequestSchema,CheckoutHeadersSchema,OwnedOrdersResponseSchema,OrderResponseSchema,ReportPaidRequestSchema,
  PaymentInstructionsResponseSchema,AdminOrderQuerySchema,AdminOrderListResponseSchema,ConfirmPaymentRequestSchema,UpdateOrderStatusRequestSchema,
  OrderFeedQuerySchema,OrderFeedCursorSchema,OrderNotificationFeedSchema,OrderSchema,
  CreateOutletRequestSchema, UpdateOutletRequestSchema, OutletSchema, FloorMapResponseSchema,
  OrderMessagesQuerySchema, SendOrderMessageSchema,
  MarkChatReadSchema, RequestRefundSchema, UpdateRefundSchema,
  CatalogStockResponseSchema,
} from '@kantin/shared';
import { Database, userDto, type Tx } from './database.js';
import { Accounts } from './accounts.js';
import { adminOnly, HttpError, databaseCode } from './errors.js';
import { Media, readImage, normalizeImage, type MediaPurpose } from './media.js';
import {ReplayCipher} from './replay.js';
import {checkout,orderDto,detailDto,customerOrderDetail} from './order-service.js';
import {listOrderMessages,sendOrderMessage} from './order-chat.js';
import {chatInbox,markChatRead,requestRefund,updateRefund} from './order-operations.js';
import {Prisma} from './generated/prisma/client.js';

type ApiRequest = Request<Record<string,string>, unknown, unknown>;
type Work = <T>(fn:(tx:Tx,actor:User)=>Promise<T>)=>Promise<T>;
type Dependencies = { db:Pick<Database,'staff'|'catalog'>&Partial<Pick<Database,'customer'|'checkout'>>; cipher?:ReplayCipher; media?:Pick<Media,'upload'|'assertAsset'|'preview'>; accounts:Pick<Accounts,'list'|'invite'|'setActive'>&Partial<Pick<Accounts,'get'>>; verify:(token:string)=>Promise<string>; origins:string[];rateLimitPerMinute?:number };
const dates = (row:{createdAt:Date;updatedAt:Date}) => ({created_at:row.createdAt.toISOString(),updated_at:row.updatedAt.toISOString()});
function outletDto(row:{id:string;name:string;location:string;floorMapUrl:string|null;isActive:boolean;createdAt:Date;updatedAt:Date}) {
  return OutletSchema.parse({
    id:row.id,name:row.name,location:row.location,floor_map_url:row.floorMapUrl,is_active:row.isActive,...dates(row),
  });
}
function tenantDto(row:{id:string;outletId:string;name:string;description:string;qrisImageUrl:string|null;qrisMerchantName:string|null;isActive:boolean;archivedAt:Date|null;createdAt:Date;updatedAt:Date}) {
  return ManagedTenantSchema.parse({id:row.id,outlet_id:row.outletId,name:row.name,description:row.description,qris_image_url:row.qrisImageUrl,qris_merchant_name:row.qrisMerchantName,is_active:row.isActive,archived_at:row.archivedAt?.toISOString()??null,...dates(row)});
}
function menuDto(row:{id:string;tenantId:string;name:string;price:number;photoUrl:string|null;isAvailable:boolean;isActive:boolean;stock:number;stockVersion:number;category:string;description:string;createdAt:Date;updatedAt:Date}) {
  return ManagedMenuSchema.parse({id:row.id,tenant_id:row.tenantId,name:row.name,price:row.price,photo_url:row.photoUrl,is_available:row.isAvailable,is_active:row.isActive,stock:row.stock,stock_version:row.stockVersion,category:row.category,description:row.description,...dates(row)});
}
function pageResult<T extends {id:string}>(rows:T[],limit:number) { return {data:rows.slice(0,limit),next_cursor:rows.length>limit?rows[limit-1]?.id??null:null}; }
export function createApp(deps: Dependencies): Express {
  const app=express(); app.disable('x-powered-by');
  const buckets=new Map<string,{count:number;until:number}>();
  app.use((req,res,next)=>{
    res.locals.requestId=randomUUID(); res.setHeader('X-Request-Id',res.locals.requestId as string);
    res.setHeader('Cache-Control','no-store'); res.setHeader('X-Content-Type-Options','nosniff');
    const origin=req.get('origin');
    if(origin && !deps.origins.includes(origin)) { next(new HttpError(403,'Origin tidak diizinkan.')); return; }
    if(origin) {res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type, Idempotency-Key');res.setHeader('Access-Control-Allow-Methods','GET, POST, PATCH, DELETE, OPTIONS');}
    if(req.method==='OPTIONS') {res.sendStatus(204);return;}
    const now=Date.now();
    if(buckets.size>10000) for(const [key,value] of buckets) if(value.until<now) buckets.delete(key);
    const key=req.ip??'unknown'; let bucket=buckets.get(key);
    if(!bucket && buckets.size>=10000) {next(new HttpError(429,'Layanan sedang sibuk. Coba kembali nanti.'));return;}
    if(!bucket || bucket.until<now) {bucket={count:0,until:now+60000};buckets.set(key,bucket);}
    if(++bucket.count>(deps.rateLimitPerMinute??3600)) {res.setHeader('Retry-After','60');next(new HttpError(429,'Terlalu banyak permintaan. Coba kembali nanti.'));return;}
    next();
  });
  app.use(express.json({limit:'16kb',strict:true}));
  app.get('/health',(_req,res)=>res.json({status:'ok'}));
  app.get('/api/tenants',async(req,res)=>{
    const q=TenantListQuerySchema.parse(req.query);
    const rows=await deps.db.catalog(res.locals.requestId as string,tx=>tx.tenant.findMany({where:{isActive:true,archivedAt:null,outlet:{isActive:true},...(q.outlet_id?{outletId:q.outlet_id}:{}),...(q.cursor?{id:{gt:q.cursor}}:{})},orderBy:{id:'asc'},take:q.limit+1}));
    res.json(TenantListResponseSchema.parse(pageResult(rows.map(row=>{const {archived_at:_archived,...dto}=tenantDto(row);void _archived;return {...dto,qris_image_url:null,qris_merchant_name:null};}),q.limit)));
  });
  app.get('/api/tenants/:tenant_id/menus',async(req,res)=>{
    const {tenant_id}=TenantParamsSchema.parse(req.params),q=PaginationQuerySchema.parse(req.query);
    const rows=await deps.db.catalog(res.locals.requestId as string,tx=>tx.menu.findMany({where:{tenantId:tenant_id,isActive:true,tenant:{isActive:true,archivedAt:null,outlet:{isActive:true}},...(q.cursor?{id:{gt:q.cursor}}:{})},orderBy:{id:'asc'},take:q.limit+1}));
    res.json(ManagedMenusResponseSchema.parse(pageResult(rows.map(menuDto),q.limit)));
  });
  app.get('/api/catalog/stock',async(req,res)=>{
    const query=PaginationQuerySchema.parse(req.query);
    const rows=await deps.db.catalog(res.locals.requestId as string,tx=>tx.menu.findMany({
      where:{isActive:true,tenant:{isActive:true,archivedAt:null,outlet:{isActive:true}},...(query.cursor?{id:{gt:query.cursor}}:{})},
      select:{id:true,stock:true,isAvailable:true},
      orderBy:{id:'asc'},take:query.limit+1,
    }));
    res.json(CatalogStockResponseSchema.parse(pageResult(rows.map(row=>({
      id:row.id,stock:row.stock,is_available:row.isAvailable && row.stock>0,
    })),query.limit)));
  });
  function media(){if(!deps.media)throw new HttpError(503,'Penyimpanan gambar belum tersedia.');return deps.media;}
  async function readFloorMap(row: {id:string;floorMapUrl:string|null}) {
    if(!row.floorMapUrl)throw new HttpError(404,'Denah belum ditambahkan.');
    const image_url=await media().preview(row.floorMapUrl,row.id,'floor_map');
    if(!image_url)throw new HttpError(503,'Denah belum dapat dimuat. Coba kembali.');
    return FloorMapResponseSchema.parse({image_url});
  }
  app.get('/api/outlets',async(req,res)=>{
    const q=PaginationQuerySchema.parse(req.query);
    const rows=await deps.db.catalog(res.locals.requestId as string,tx=>tx.outlet.findMany({
      where:{isActive:true,...(q.cursor?{id:{gt:q.cursor}}:{})},orderBy:{id:'asc'},take:q.limit+1,
    }));
    res.json(OutletListResponseSchema.parse(pageResult(rows.map(outletDto),q.limit)));
  });
  async function publicOutlet(req:ApiRequest,res:Response) {
    const {id}=IdParamsSchema.parse(req.params);
    const row=await deps.db.catalog(res.locals.requestId as string,tx=>tx.outlet.findFirst({where:{id,isActive:true}}));
    if(!row)throw new HttpError(404,'Lokasi kantin tidak ditemukan.');
    return row;
  }
  app.get('/api/outlets/:id',async(req:ApiRequest,res)=>{res.json(outletDto(await publicOutlet(req,res)));});
  app.get('/api/outlets/:id/floor-map',async(req:ApiRequest,res)=>{res.json(await readFloorMap(await publicOutlet(req,res)));});
  async function previewTenant(row:Parameters<typeof tenantDto>[0]){const dto=tenantDto(row);return {...dto,qris_preview_url:dto.qris_image_url?await deps.media?.preview(dto.qris_image_url,dto.id)??null:null};}
  function route(method:'get'|'post'|'patch'|'delete',path:string,admin:boolean,handler:(req:ApiRequest,res:Response,work:Work,actor:User)=>Promise<void>) {
    app[method](path,async(req:ApiRequest,res)=>{
      const match=/^Bearer ([A-Za-z0-9_.-]+)$/.exec(req.get('authorization')??'');
      if(!match?.[1]) throw new HttpError(401,'Silakan masuk terlebih dahulu.');
      const sub=await deps.verify(match[1]); const requestId=res.locals.requestId as string;
      const work:Work=fn=>deps.db.staff(sub,requestId,(tx,actor)=>{if(admin)adminOnly(actor.role);return fn(tx,actor);});
      const actor=await work(async(_tx,current)=>current);
      await handler(req,res,work,actor);
    });
  }
  route('get','/api/me',false,async(_req,res,_work,actor)=>{res.json(MeResponseSchema.parse({data:actor}));});
  route('post','/api/admin/catalog-import',true,async(req,res,work)=>{
    const input=VendorImportRequestSchema.parse(req.body);
    const data=await work(async tx=>{
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(20261121)`;
      const outlet=await tx.outlet.findUnique({where:{id:input.outlet_id}});if(!outlet?.isActive)throw new HttpError(409,'Lokasi kantin tidak aktif.');
      let created_tenants=0,created_menus=0,skipped_menus=0;
      for(const entry of VENDOR_CATALOG){let tenant=await tx.tenant.findFirst({where:{outletId:input.outlet_id,name:{equals:entry.name,mode:'insensitive'}}});if(tenant?.archivedAt)throw new HttpError(409,'Pulihkan tenant '+entry.name+' sebelum import.');if(!tenant){tenant=await tx.tenant.create({data:{outletId:input.outlet_id,name:entry.name,description:entry.description,isActive:false}});created_tenants++;}
        for(const menu of entry.menus){if(await tx.menu.findFirst({where:{tenantId:tenant.id,name:{equals:menu.name,mode:'insensitive'}}})){skipped_menus++;continue;}await tx.menu.create({data:{tenantId:tenant.id,name:menu.name,price:menu.price,category:menu.category,description:'',stock:0,isAvailable:false}});created_menus++;}}
      return {created_tenants,created_menus,skipped_menus};
    });res.json(VendorImportResponseSchema.parse({data}));
  });
  route('post','/api/admin/tenant-accounts/link',true,async(req,res,work)=>{
    const input=ExistingTenantAccountSchema.parse(req.body);if(!deps.accounts.get)throw new HttpError(503,'Layanan akun belum siap.');const auth=await deps.accounts.get(input.user_id);
    if(!auth.email)throw new HttpError(409,'Akun harus memiliki email.');
    const row=await work(async tx=>{const tenant=await tx.tenant.findUnique({where:{id:input.tenant_id}});if(!tenant||tenant.archivedAt)throw new HttpError(404,'Tenant tidak tersedia.');const existing=await tx.user.findUnique({where:{id:input.user_id}});if(existing){if(existing.role!=='tenant'||existing.tenantId!==input.tenant_id)throw new HttpError(409,'Akun sudah memiliki akses staf lain.');return existing;}return tx.user.create({data:{id:auth.id,email:auth.email as string,role:'tenant',tenantId:input.tenant_id,isActive:true}});});res.status(201).json(MeResponseSchema.parse({data:userDto(row)}));
  });
  async function owner(req:ApiRequest,res:Response){const match=/^Bearer ([A-Za-z0-9_.-]+)$/.exec(req.get('authorization')??'');if(!match?.[1])throw new HttpError(401,'Masuk sebelum memesan.');const sub=await deps.verify(match[1]);if(!deps.db.customer)throw new HttpError(503,'Layanan pesanan belum siap.');return {sub,work:<T>(fn:(tx:Tx)=>Promise<T>)=>deps.db.customer!(sub,res.locals.requestId as string,fn)};}
  type ChatTransaction = <T>(fn:(tx:Tx)=>Promise<T>)=>Promise<T>;
  async function readChat(req:ApiRequest,res:Response,work:ChatTransaction) {
    const {id}=IdParamsSchema.parse(req.params);
    const {cursor}=OrderMessagesQuerySchema.parse(req.query);
    res.json(await work(tx=>listOrderMessages(tx,id,cursor)));
  }
  async function sendChat(req:ApiRequest,res:Response,work:ChatTransaction) {
    const {id}=IdParamsSchema.parse(req.params);
    EmptyBodySchema.parse(req.query);
    const input=SendOrderMessageSchema.parse(req.body);
    const result=await work(tx=>sendOrderMessage(tx,id,input));
    res.status(result.created?201:200).json(result.response);
  }
  for (const [method, handler] of [['get',readChat],['post',sendChat]] as const) {
    app[method]('/api/orders/:id/messages',async(req:ApiRequest,res)=>{
      const {work}=await owner(req,res);
      await handler(req,res,work);
    });
    route(method,'/api/admin/orders/:id/messages',false,async(req,res,work,actor)=>{
      if (actor.role!=='tenant') throw new HttpError(404,'Chat pesanan tidak tersedia.');
      await handler(req,res,fn=>work((tx,current)=>{
        if (current.role!=='tenant') throw new HttpError(404,'Chat pesanan tidak tersedia.');
        return fn(tx);
      }));
    });
  }
  app.get('/api/chat-inbox',async(req:ApiRequest,res)=>{
    const {sub,work}=await owner(req,res);
    EmptyBodySchema.parse(req.query);
    res.json(await work(tx=>chatInbox(tx,sub,'pelanggan')));
  });
  app.post('/api/orders/:id/messages/read',async(req:ApiRequest,res)=>{
    const {sub,work}=await owner(req,res);
    const {id}=IdParamsSchema.parse(req.params);
    const {message_id}=MarkChatReadSchema.parse(req.body);
    await work(tx=>markChatRead(tx,id,sub,'pelanggan',message_id));
    res.sendStatus(204);
  });
  route('get','/api/admin/chat-inbox',false,async(req,res,work)=>{
    EmptyBodySchema.parse(req.query);
    res.json(await work((tx,actor)=>{
      if(actor.role!=='tenant')throw new HttpError(403,'Kotak pesan hanya untuk tenant.');
      return chatInbox(tx,actor.id,'tenant');
    }));
  });
  route('post','/api/admin/orders/:id/messages/read',false,async(req,res,work)=>{
    const {id}=IdParamsSchema.parse(req.params);
    const {message_id}=MarkChatReadSchema.parse(req.body);
    await work((tx,actor)=>{
      if(actor.role!=='tenant')throw new HttpError(403,'Kotak pesan hanya untuk tenant.');
      return markChatRead(tx,id,actor.id,'tenant',message_id);
    });
    res.sendStatus(204);
  });
  app.post('/api/orders/:id/refund',async(req:ApiRequest,res)=>{
    const {work}=await owner(req,res);
    const {id}=IdParamsSchema.parse(req.params);
    const {reason}=RequestRefundSchema.parse(req.body);
    const result=await work(tx=>requestRefund(tx,id,reason));
    res.status(result.created?201:200).json(result.response);
  });
  route('patch','/api/admin/orders/:id/refund',false,async(req,res,work)=>{
    const {id}=IdParamsSchema.parse(req.params);
    const input=UpdateRefundSchema.parse(req.body);
    res.json(await work((tx,actor)=>updateRefund(tx,id,actor.id,input)));
  });
  const checkoutLimits=new Map<string,{until:number;count:number}>();
  app.post('/api/orders',async(req:ApiRequest,res)=>{const {sub}=await owner(req,res);const input=CreateOrdersRequestSchema.parse(req.body),header=CheckoutHeadersSchema.parse({idempotency_key:req.get('idempotency-key')});const now=Date.now();if(checkoutLimits.size>10000)for(const [id,value]of checkoutLimits)if(value.until<now)checkoutLimits.delete(id);let limit=checkoutLimits.get(sub);if(!limit||limit.until<now){if(checkoutLimits.size>=10000&&!limit)throw new HttpError(429,'Checkout sedang sibuk. Coba kembali.');limit={until:now+60000,count:0};checkoutLimits.set(sub,limit);}if(++limit.count>10)throw new HttpError(429,'Terlalu banyak percobaan checkout. Periksa pesanan lalu coba kembali.');if(!deps.db.checkout||!deps.cipher)throw new HttpError(503,'Checkout belum dikonfigurasi.');const orders=await checkout({checkout:deps.db.checkout.bind(deps.db)},deps.cipher,sub,header.idempotency_key,input,res.locals.requestId as string);res.status(201).json(orders);});
  app.get('/api/orders',async(req:ApiRequest,res)=>{const {sub,work}=await owner(req,res),q=PaginationQuerySchema.parse(req.query);const rows=await work(async tx=>{const cursor=q.cursor?await tx.order.findFirst({where:{id:q.cursor,customerId:sub}}):null;if(q.cursor&&!cursor)throw new HttpError(404,'Pesanan tidak ditemukan.');return tx.order.findMany({where:{customerId:sub,...(cursor?{OR:[{createdAt:{lt:cursor.createdAt}},{createdAt:cursor.createdAt,id:{lt:cursor.id}}]}:{})},include:customerOrderDetail,orderBy:[{createdAt:'desc'},{id:'desc'}],take:q.limit+1});});res.json(OwnedOrdersResponseSchema.parse({data:rows.slice(0,q.limit).map(row=>detailDto(row)),next_cursor:rows.length>q.limit?rows[q.limit-1]?.id??null:null}));});
  async function payment(work:<T>(fn:(tx:Tx)=>Promise<T>)=>Promise<T>,id:string){const snapshot=await work(async tx=>{const row=await tx.order.findUnique({where:{id}});if(!row)throw new HttpError(404,'Pesanan tidak ditemukan.');const payment=await tx.orderPaymentSnapshot.findUniqueOrThrow({where:{orderId:id}});return {row,payment};});const url=await media().preview(snapshot.payment.qrisImageUrl,snapshot.row.tenantId);if(!url)throw new HttpError(503,'Gambar QRIS belum dapat dimuat. Coba kembali.');return PaymentInstructionsResponseSchema.parse({order_id:id,total:snapshot.row.total,qris:{image_url:url,merchant_name:snapshot.payment.merchantName}});}
  app.get('/api/orders/:id/payment',async(req:ApiRequest,res)=>{const {work}=await owner(req,res),{id}=IdParamsSchema.parse(req.params);res.json(await payment(work,id));});
  app.get('/api/orders/:id',async(req:ApiRequest,res)=>{const {work}=await owner(req,res),{id}=IdParamsSchema.parse(req.params);const row=await work(tx=>tx.order.findUnique({where:{id},include:customerOrderDetail}));if(!row)throw new HttpError(404,'Pesanan tidak ditemukan.');res.json(detailDto(row));});
  app.patch('/api/orders/:id/paid',async(req:ApiRequest,res)=>{const {work}=await owner(req,res),{id}=IdParamsSchema.parse(req.params),input=ReportPaidRequestSchema.parse(req.body);const row=await work(async tx=>{const current=await tx.order.findUnique({where:{id}});if(!current)throw new HttpError(404,'Pesanan tidak ditemukan.');if(current.status==='menunggu_konfirmasi')return current;if(current.version!==input.expected_version||current.status!=='menunggu_bayar')throw new HttpError(409,'Status pesanan sudah berubah. Muat ulang.');await tx.$queryRaw`SELECT set_config('kantin.expected_version',${String(input.expected_version)},true)`;return tx.order.update({where:{id},data:{status:'menunggu_konfirmasi'}});});res.json(OrderResponseSchema.parse({data:orderDto(row)}));});
  route('get','/api/admin/orders',false,async(req,res,work)=>{
    const query=AdminOrderQuerySchema.parse(req.query);
    const rows=await work(async(tx,actor)=>{
      if(actor.role==='tenant' && query.tenant_id && actor.tenant_id!==query.tenant_id)
        throw new HttpError(403,'Tenant tidak diizinkan.');
      const tenantId=actor.role==='tenant' ? actor.tenant_id : query.tenant_id;
      const scope=tenantId ? {tenantId} : {};
      const cursor=query.cursor ? await tx.order.findFirst({where:{id:query.cursor,...scope}}) : null;
      if(query.cursor && !cursor)throw new HttpError(404,'Pesanan tidak ditemukan.');
      return tx.order.findMany({
        where:{
          ...scope,
          ...(query.status ? {status:query.status} : {}),
          ...(query.payment_status ? {paymentStatus:query.payment_status} : {}),
          ...(query.refund_pending ? {refund:{is:{status:{in:['diminta','diproses']}}}} : {}),
          ...(cursor ? {OR:[{createdAt:{lt:cursor.createdAt}},{createdAt:cursor.createdAt,id:{lt:cursor.id}}]} : {}),
        },
        include:{refund:{select:{status:true}}},
        orderBy:[{createdAt:'desc'},{id:'desc'}],
        take:query.limit+1,
      });
    });
    res.json(AdminOrderListResponseSchema.parse(pageResult(rows.map(row=>({
      ...orderDto(row), ...(row.refund ? {refund_status:row.refund.status} : {}),
    })),query.limit)));
  });
  async function staffOrder(tx:Tx,actor:User,id:string){
    const row=await tx.order.findFirst({
      where:{id,...(actor.role==='tenant'?{tenantId:actor.tenant_id??''}:{})},
      include:{items:true,paymentWindow:true,refund:true,fulfillment:true,paymentSnapshots:{select:{merchantName:true},take:1}},
    });
    if(!row)throw new HttpError(404,'Pesanan tidak ditemukan.');
    return row;
  }
  route('get','/api/admin/orders/:id',false,async(req,res,work)=>{
    const {id}=IdParamsSchema.parse(req.params);
    res.json(await work(async(tx,actor)=>detailDto(await staffOrder(tx,actor,id),actor.id)));
  });
  route('get','/api/admin/orders/:id/payment',false,async(req,res,work)=>{const {id}=IdParamsSchema.parse(req.params);await work((tx,actor)=>staffOrder(tx,actor,id));res.json(await payment(fn=>work(tx=>fn(tx)),id));});
  for(const action of ['confirm-payment','status'] as const)route('patch','/api/admin/orders/:id/'+action,false,async(req,res,work)=>{const {id}=IdParamsSchema.parse(req.params);const input=action==='confirm-payment'?ConfirmPaymentRequestSchema.parse(req.body):UpdateOrderStatusRequestSchema.parse(req.body);const row=await work(async(tx,actor)=>{const current=await staffOrder(tx,actor,id);if(current.version!==input.expected_version)throw new HttpError(409,'Pesanan sudah diperbarui. Muat ulang.');const reason='reason'in input?input.reason??'':'';const status='decision'in input?input.decision==='accept'?'diproses':'menunggu_bayar':input.status;await tx.$queryRaw`SELECT set_config('kantin.expected_version',${String(input.expected_version)},true),set_config('kantin.rejection_reason',${reason},true)`;return tx.order.update({where:{id},data:{status}});});res.json(OrderResponseSchema.parse({data:orderDto(row)}));});
  route('get','/api/admin/order-notifications',false,async(req,res,work)=>{const q=OrderFeedQuerySchema.parse(req.query);let cursor:ReturnType<typeof OrderFeedCursorSchema.parse>|null=null;if(q.cursor){try{cursor=OrderFeedCursorSchema.parse(JSON.parse(Buffer.from(q.cursor,'base64url').toString('utf8')) as unknown);}catch{throw new HttpError(400,'Cursor notifikasi tidak valid.');}}const rows=await work((tx,actor)=>{const scope=actor.role==='tenant'?Prisma.sql`o.tenant_id=${actor.tenant_id}::uuid`:Prisma.sql`true`;return cursor?tx.$queryRaw<{data:unknown}[]>(Prisma.sql`SELECT to_jsonb(o)-'customer_id' AS data FROM public.orders o WHERE ${scope} AND (o.updated_at>${cursor.updated_at}::timestamptz OR(o.updated_at=${cursor.updated_at}::timestamptz AND o.id>${cursor.id}::uuid)) ORDER BY o.updated_at,o.id LIMIT 101`):tx.$queryRaw<{data:unknown}[]>(Prisma.sql`SELECT to_jsonb(o)-'customer_id' AS data FROM public.orders o WHERE ${scope} ORDER BY o.updated_at DESC,o.id DESC LIMIT 100`);});const data=(cursor?rows.slice(0,100):rows.reverse()).map(row=>OrderSchema.parse(row.data));const last=data.at(-1);const next=last?{updated_at:last.updated_at,id:last.id}:cursor??{updated_at:new Date(0).toISOString(),id:randomUUID()};res.json(OrderNotificationFeedSchema.parse({data,next_cursor:Buffer.from(JSON.stringify(next)).toString('base64url'),has_more:!!cursor&&rows.length>100}));});
  route('get','/api/admin/outlets',false,async(req,res,work)=>{
    const q=PaginationQuerySchema.parse(req.query);
    const rows=await work(tx=>tx.outlet.findMany({where:q.cursor?{id:{gt:q.cursor}}:{},orderBy:{id:'asc'},take:q.limit+1}));
    res.json(OutletListResponseSchema.parse(pageResult(rows.map(outletDto),q.limit)));
  });
  route('get','/api/admin/outlets/:id',true,async(req,res,work)=>{
    const {id}=IdParamsSchema.parse(req.params);
    res.json(outletDto(await work(tx=>tx.outlet.findUniqueOrThrow({where:{id}}))));
  });
  route('get','/api/admin/outlets/:id/floor-map',true,async(req,res,work)=>{
    const {id}=IdParamsSchema.parse(req.params);
    const row=await work(tx=>tx.outlet.findUniqueOrThrow({where:{id}}));
    res.json(await readFloorMap(row));
  });
  route('post','/api/admin/outlets',true,async(req,res,work)=>{
    const input=CreateOutletRequestSchema.parse(req.body);
    if(input.floor_map_url!==null)throw new HttpError(400,'Simpan lokasi sebelum menambahkan denah.');
    const row=await work(tx=>tx.outlet.create({data:{name:input.name,location:input.location,isActive:false}}));
    res.status(201).json(outletDto(row));
  });
  async function ensureOutletCanClose(tx:Tx,id:string){
    await tx.$queryRaw`SELECT id FROM public.outlets WHERE id=${id}::uuid FOR UPDATE`;
    if(await tx.tenant.count({where:{outletId:id,isActive:true}})) {
      throw new HttpError(409,'Nonaktifkan tenant di lokasi ini terlebih dahulu.');
    }
  }
  route('patch','/api/admin/outlets/:id',true,async(req,res,work)=>{
    const {id}=IdParamsSchema.parse(req.params);
    const input=UpdateOutletRequestSchema.parse(req.body);
    if(input.floor_map_url)await media().assertAsset(input.floor_map_url,'floor_map',id);
    const row=await work(async tx=>{
      if(input.is_active===false)await ensureOutletCanClose(tx,id);
      return tx.outlet.update({where:{id},data:{
        ...(input.name!==undefined?{name:input.name}:{}),
        ...(input.location!==undefined?{location:input.location}:{}),
        ...(input.floor_map_url!==undefined?{floorMapUrl:input.floor_map_url}:{}),
        ...(input.is_active!==undefined?{isActive:input.is_active}:{}),
      }});
    });
    res.json(outletDto(row));
  });
  route('delete','/api/admin/outlets/:id',true,async(req,res,work)=>{
    const {id}=IdParamsSchema.parse(req.params);
    EmptyBodySchema.parse(req.body??{});
    await work(async tx=>{
      await ensureOutletCanClose(tx,id);
      await tx.outlet.update({where:{id},data:{isActive:false}});
    });
    res.sendStatus(204);
  });
  route('get','/api/admin/tenants',false,async(req,res,work)=>{
    const q=PaginationQuerySchema.parse(req.query);
    const rows=await work((tx,actor)=>tx.tenant.findMany({where:{...(q.cursor?{id:{gt:q.cursor}}:{}),...(actor.role==='tenant'?{id:actor.tenant_id??''}:{})},orderBy:{id:'asc'},take:q.limit+1}));
    res.json(ManagedTenantsResponseSchema.parse(pageResult(await Promise.all(rows.map(previewTenant)),q.limit)));
  });
  route('get','/api/admin/tenants/:id',false,async(req,res,work)=>{
    const {id}=IdParamsSchema.parse(req.params);
    const row=await work(async(tx,actor)=>{if(actor.role==='tenant'&&actor.tenant_id!==id)throw new HttpError(404,'Tenant tidak ditemukan.');const row=await tx.tenant.findUnique({where:{id}});if(!row)throw new HttpError(404,'Tenant tidak ditemukan.');return row;});
    res.json({data:await previewTenant(row)});
  });
  let uploads=0;
  route('post','/api/admin/uploads',false,async(req,res,work,actor)=>{
    const q=UploadQuerySchema.parse(req.query);
    const purpose:MediaPurpose=q.purpose;
    if(purpose!=='menu_photo')adminOnly(actor.role);
    const check=()=>work(async(tx,current)=>{
      if(purpose==='floor_map'){
        adminOnly(current.role);
        await tx.outlet.findUniqueOrThrow({where:{id:q.owner_id}});
        return;
      }
      if(purpose==='tenant_qris')adminOnly(current.role);
      if(current.role==='tenant'&&current.tenant_id!==q.owner_id)throw new HttpError(404,'Tenant tidak ditemukan.');
      const tenant=await tx.tenant.findUnique({where:{id:q.owner_id}});
      if(!tenant||tenant.archivedAt)throw new HttpError(404,'Tenant tidak tersedia.');
    });
    await check();if(uploads>=4)throw new HttpError(429,'Upload sedang penuh. Coba kembali sebentar lagi.');uploads++;
    try{const input=await readImage(req),bytes=await normalizeImage(input.bytes,input.mime,purpose);await check();const asset_url=await media().upload(bytes,purpose,q.owner_id);res.status(201).json(UploadResponseSchema.parse({asset_url}));}finally{uploads--;}
  });
  route('post','/api/admin/tenants',true,async(req,res,work)=>{
    const input=CreateTenantRequestSchema.parse(req.body);
    if(input.qris_image_url!==null || input.qris_merchant_name!==null) throw new HttpError(400,'Buat draft dahulu; QRIS memerlukan alur aset terverifikasi.');
    const row=await work(tx=>tx.tenant.create({data:{outletId:input.outlet_id,name:input.name,description:input.description,isActive:false}}));
    res.status(201).json({data:tenantDto(row)});
  });
  route('patch','/api/admin/tenants/:id',true,async(req,res,work)=>{
    const {id}=IdParamsSchema.parse(req.params); const input=ManagedTenantPatchSchema.parse(req.body);
    if(input.outlet_id!==undefined) throw new HttpError(400,'Pengubahan outlet belum tersedia pada tahap ini.');
    if(input.qris_image_url)await media().assertAsset(input.qris_image_url,'tenant_qris',id);
    const row=await work(async tx=>{
      const current=await tx.tenant.findUnique({where:{id}});if(!current)throw new HttpError(404,'Tenant tidak ditemukan.');
      const qris=input.qris_image_url===undefined?current.qrisImageUrl:input.qris_image_url,merchant=input.qris_merchant_name===undefined?current.qrisMerchantName:input.qris_merchant_name;
      if(input.is_active===true) {
        const outlet=await tx.$queryRaw<{id:string}[]>`SELECT id FROM public.outlets WHERE id=${current.outletId}::uuid AND is_active FOR SHARE`;
        if(!outlet.length)throw new HttpError(409,'Aktifkan lokasi kantin terlebih dahulu.');
        if(current.archivedAt || !qris || !merchant || !await tx.menu.count({where:{tenantId:id,isActive:true,stock:{gt:0},isAvailable:true}})) throw new HttpError(409,'Lengkapi QRIS dan menu tersedia sebelum aktivasi.');
      }
      if(current.isActive&&(!qris||!merchant)&&input.is_active!==false&&!input.archived)throw new HttpError(409,'Nonaktifkan tenant sebelum menghapus QRIS.');
      return tx.tenant.update({where:{id},data:{...(input.name!==undefined?{name:input.name}:{}),...(input.description!==undefined?{description:input.description}:{}),...(input.qris_image_url!==undefined?{qrisImageUrl:input.qris_image_url}:{}),...(input.qris_merchant_name!==undefined?{qrisMerchantName:input.qris_merchant_name}:{}),...(input.is_active!==undefined?{isActive:input.is_active}:{}),...(input.archived!==undefined?{archivedAt:input.archived?new Date():null,isActive:false}:{})}});
    });res.json({data:await previewTenant(row)});
  });
  route('get','/api/admin/menus',false,async(req,res,work)=>{
    const q=ManagementQuerySchema.parse(req.query);
    const rows=await work((tx,actor)=>{
      if(actor.role==='tenant' && q.tenant_id && q.tenant_id!==actor.tenant_id) throw new HttpError(403,'Scope tenant tidak diizinkan.');
      return tx.menu.findMany({where:{isActive:true,...(q.cursor?{id:{gt:q.cursor}}:{}),...(actor.role==='tenant'?{tenantId:actor.tenant_id??''}:q.tenant_id?{tenantId:q.tenant_id}:{})},orderBy:{id:'asc'},take:q.limit+1});
    });res.json(ManagedMenusResponseSchema.parse(pageResult(rows.map(menuDto),q.limit)));
  });
  route('post','/api/admin/menus',false,async(req,res,work,actor)=>{
    const input=ManagedMenuCreateSchema.parse(req.body);
    if(actor.role==='tenant'&&actor.tenant_id!==input.tenant_id)throw new HttpError(404,'Tenant tidak ditemukan.');
    if(input.photo_url)await media().assertAsset(input.photo_url,'menu_photo',input.tenant_id);
    const row=await work(async(tx,actor)=>{
      if(actor.role==='tenant' && actor.tenant_id!==input.tenant_id)throw new HttpError(404,'Tenant tidak ditemukan.');
      const tenant=await tx.tenant.findUnique({where:{id:input.tenant_id}});
      if(!tenant || tenant.archivedAt)throw new HttpError(409,'Tenant tidak tersedia atau sudah diarsipkan.');
      return tx.menu.create({data:{tenantId:input.tenant_id,name:input.name,price:input.price,photoUrl:input.photo_url,isAvailable:input.is_available,category:input.category,description:input.description,stock:input.stock}});
    });res.status(201).json({data:menuDto(row)});
  });
  async function scopedMenu(tx:Tx,actor:User,id:string) {
    const row=await tx.menu.findFirst({where:{id,isActive:true,...(actor.role==='tenant'?{tenantId:actor.tenant_id??''}:{})}});
    if(!row)throw new HttpError(404,'Menu tidak ditemukan.');return row;
  }
  route('patch','/api/admin/menus/:id',false,async(req,res,work)=>{
    const {id}=IdParamsSchema.parse(req.params);const input=ManagedMenuPatchSchema.parse(req.body);
    if(input.photo_url){const current=await work((tx,actor)=>scopedMenu(tx,actor,id));await media().assertAsset(input.photo_url,'menu_photo',current.tenantId);}
    const row=await work(async(tx,actor)=>{const current=await scopedMenu(tx,actor,id);
      if(input.is_available && current.stock===0)throw new HttpError(409,'Isi stok sebelum mengaktifkan menu.');
      return tx.menu.update({where:{id},data:{...(input.name!==undefined?{name:input.name}:{}),...(input.price!==undefined?{price:input.price}:{}),...(input.photo_url!==undefined?{photoUrl:input.photo_url}:{}),...(input.category!==undefined?{category:input.category}:{}),...(input.description!==undefined?{description:input.description}:{}),...(input.is_available!==undefined?{isAvailable:input.is_available}:{})}});
    });res.json({data:menuDto(row)});
  });
  route('patch','/api/admin/menus/:id/stock',false,async(req,res,work)=>{
    const {id}=IdParamsSchema.parse(req.params);const input=StockUpdateSchema.parse(req.body);
    const row=await work(async(tx,actor)=>{
      await scopedMenu(tx,actor,id);
      const result=await tx.menu.updateMany({where:{id,stockVersion:input.expected_version},data:{stock:input.stock,isAvailable:input.stock>0}});
      if(!result.count)throw new HttpError(409,'Stok sudah berubah. Muat ulang sebelum menyimpan.');
      const updated=await tx.menu.findUniqueOrThrow({where:{id}});return updated;
    });res.json({data:menuDto(row)});
  });
  route('delete','/api/admin/menus/:id',false,async(req,res,work)=>{
    const {id}=IdParamsSchema.parse(req.params);EmptyBodySchema.parse(req.body??{});
    await work(async(tx,actor)=>{await scopedMenu(tx,actor,id);await tx.menu.update({where:{id},data:{isActive:false}});});res.sendStatus(204);
  });
  route('get','/api/admin/users',true,async(req,res,work)=>{
    const {page}=ManagedUsersQuerySchema.parse(req.query);const users=await deps.accounts.list(page);
    const profiles=await work(tx=>tx.user.findMany({where:{id:{in:users.map(user=>user.id)}}}));
    const rows=users.map(user=>{
      const profile=profiles.find(entry=>entry.id===user.id);const name=NameSchema.safeParse(user.user_metadata?.display_name);
      const banned='banned_until' in user && typeof user.banned_until==='string' && new Date(user.banned_until).getTime()>Date.now();
      return {id:user.id,email:user.email??'',name:name.success?name.data:null,role:profile?.role??'pelanggan',tenant_id:profile?.tenantId??null,is_active:profile?profile.isActive&&!banned:!banned,created_at:user.created_at};
    });res.json(ManagedUsersResponseSchema.parse({data:rows,next_page:users.length===50?page+1:null}));
  });
  route('post','/api/admin/tenant-accounts',true,async(req,res,work)=>{
    const input=CreateTenantAccountRequestSchema.parse(req.body);
    const existing=await work(tx=>tx.user.findUnique({where:{email:input.email}}));
    if(existing) {
      if(existing.role!=='tenant'||existing.tenantId!==input.tenant_id)throw new HttpError(409,'Email sudah dipakai akun dengan akses lain.');
      res.json(MeResponseSchema.parse({data:userDto(existing)}));return;
    }
    await work(async tx=>{const tenant=await tx.tenant.findUnique({where:{id:input.tenant_id}});if(!tenant||tenant.archivedAt)throw new HttpError(404,'Tenant tidak tersedia.');});
    const invited=await deps.accounts.invite(input.email);
    const profile=await work(async tx=>{
      const tenant=await tx.tenant.findUnique({where:{id:input.tenant_id}});if(!tenant||tenant.archivedAt)throw new HttpError(409,'Tenant berubah. Akun belum diberi akses.');
      return tx.user.create({data:{id:invited.id,email:input.email,role:'tenant',tenantId:input.tenant_id,isActive:true}});
    });res.status(201).json(MeResponseSchema.parse({data:userDto(profile)}));
  });
  route('patch','/api/admin/users/:id',true,async(req,res,work,actor)=>{
    const {id}=IdParamsSchema.parse(req.params);const {is_active}=UserStatusSchema.parse(req.body);
    if(id===actor.id&&!is_active)throw new HttpError(409,'Anda tidak dapat menonaktifkan akun sendiri.');
    // Deny staff access first; an Auth outage must never leave staff authorization enabled.
    if(!is_active)await work(async tx=>{await tx.user.updateMany({where:{id},data:{isActive:false}});});
    await deps.accounts.setActive(id,is_active);
    if(is_active)await work(async tx=>{await tx.user.updateMany({where:{id},data:{isActive:true}});});
    res.json({data:{id,is_active}});
  });
  app.use((_req,_res,next)=>next(new HttpError(404,'Endpoint tidak ditemukan.')));
  app.use((error:unknown,_req:Request,res:Response,_next:NextFunction)=>{
    void _next;
    const sqlCode=databaseCode(error);
    const status=error instanceof ZodError?400:error instanceof HttpError?error.status:sqlCode==='P2025'?404:sqlCode==='42501'?403:['P2002','P2003','P2004','P2010','P2034','23514','23505','23503','40001','40P01','22023'].includes(sqlCode)?409:typeof error==='object'&&error!==null&&'status' in error&&[400,413].includes(Number(error.status))?Number(error.status):500;
    const code=status===400?'VALIDATION_ERROR':status===401?'UNAUTHENTICATED':status===403?'FORBIDDEN':status===404?'NOT_FOUND':status===409?'CONFLICT':status===429?'RATE_LIMITED':'INTERNAL_ERROR';
    const message=error instanceof HttpError?error.message:status===400?'Periksa format dan isian permintaan.':status===409?'Perubahan ditolak karena data atau status tidak sesuai.':status===404?'Data tidak ditemukan.':'Layanan belum dapat memproses permintaan.';
    res.status(status).json(ApiErrorSchema.parse({error:{code,message,request_id:res.locals.requestId as string}}));
  });
  return app;
}
