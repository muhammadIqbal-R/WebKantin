import {
  ChatInboxSchema, OrderRefundResponseSchema, OrderRefundSchema, type UpdateRefund,
} from '@kantin/shared';
import type { Tx } from './database.js';
import type { OrderRefund } from './generated/prisma/client.js';
import { HttpError } from './errors.js';

export function refundDto(row: OrderRefund, actor?: string) {
  return OrderRefundSchema.parse({
    source:row.source, amount:row.amount, reason:row.reason, status:row.status, version:row.version,
    can_complete:row.status==='diproses' && row.processorId === actor,
    resolution_note:row.resolutionNote, created_at:row.createdAt.toISOString(),
    resolved_at:row.resolvedAt?.toISOString() ?? null,
  });
}

export async function requestRefund(tx: Tx, id: string, reason: string) {
  const order = await tx.order.findUnique({
    where:{id}, select:{paymentStatus:true,status:true,paymentWindow:{select:{expiredAt:true}}},
  });
  if (!order) throw new HttpError(404,'Pesanan tidak ditemukan.');
  const existing = await tx.orderRefund.findUnique({where:{orderId:id}});
  if (existing) return {created:false, response:OrderRefundResponseSchema.parse({data:refundDto(existing)})};
  if (order.paymentStatus!=='paid' && !(order.status==='dibatalkan' && order.paymentWindow?.expiredAt)) {
    throw new HttpError(409,'Refund belum tersedia untuk pesanan ini.');
  }
  const result = await tx.orderRefund.create({data:{orderId:id,reason}});
  return {created:true, response:OrderRefundResponseSchema.parse({data:refundDto(result)})};
}

export async function updateRefund(tx: Tx, id: string, actor: string, input: UpdateRefund) {
  const current = await tx.orderRefund.findUnique({where:{orderId:id}});
  if (!current) throw new HttpError(404,'Pengajuan refund tidak ditemukan.');
  const wanted = input.action==='complete' ? 'diproses' : 'diminta';
  if (current.version!==input.expected_version || current.status!==wanted ||
    (input.action==='complete' && current.processorId!==actor)) {
    throw new HttpError(409,'Pengajuan sudah berubah atau sedang ditangani petugas lain. Muat ulang.');
  }
  const data = input.action==='complete' ? {status:'dikembalikan',transferRef:input.transfer_ref}
    : input.action==='reject' ? {status:'ditolak',resolutionNote:input.note}
      : {status:'diproses'};
  const changed = await tx.orderRefund.updateMany({
    where:{orderId:id,version:input.expected_version,status:wanted},data,
  });
  if (!changed.count) throw new HttpError(409,'Pengajuan sudah berubah. Muat ulang.');
  const result = await tx.orderRefund.findUniqueOrThrow({where:{orderId:id}});
  return OrderRefundResponseSchema.parse({data:refundDto(result,actor)});
}

type Side = 'pelanggan'|'tenant';
export async function chatInbox(tx: Tx, actor: string, side: Side) {
  const rows = await tx.$queryRaw<{order_id:string;order_code:string;unread:number;total:number}[]>`
    WITH unread_threads AS (
      SELECT o.id AS order_id, o.order_code, count(*)::int AS unread, max(m.sequence) AS latest
      FROM public.orders o
      JOIN app_private.order_messages m ON m.order_id=o.id AND m.sender<>${side}
      LEFT JOIN app_private.order_chat_receipts r ON r.order_id=o.id AND r.reader_id=${actor}::uuid
      WHERE m.sequence>coalesce(r.last_read_sequence,0) AND app_private.order_chat_role(o.id)=${side}
      GROUP BY o.id,o.order_code
    )
    SELECT order_id,order_code,unread,(count(*) OVER ())::int AS total
    FROM unread_threads ORDER BY latest DESC LIMIT 30
  `;
  return ChatInboxSchema.parse({
    unread:rows[0]?.total ?? 0, data:rows.map(({order_id,order_code,unread})=>({order_id,order_code,unread})),
  });
}

export async function markChatRead(tx: Tx, orderId: string, actor: string, side: Side, messageId: string) {
  const [message] = await tx.$queryRaw<{sequence:bigint}[]>`
    SELECT sequence FROM app_private.order_messages
    WHERE order_id=${orderId}::uuid AND id=${messageId}::uuid AND sender<>${side}
      AND app_private.order_chat_role(order_id)=${side}
  `;
  if (!message) throw new HttpError(404,'Pesan tidak ditemukan.');
  await tx.$executeRaw`
    INSERT INTO app_private.order_chat_receipts(order_id,reader_id,last_read_sequence)
    VALUES(${orderId}::uuid,${actor}::uuid,${message.sequence})
    ON CONFLICT (order_id,reader_id) DO UPDATE
    SET last_read_sequence=greatest(order_chat_receipts.last_read_sequence,excluded.last_read_sequence)
  `;
}
