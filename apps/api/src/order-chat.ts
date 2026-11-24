import {
  OrderMessageResponseSchema, OrderMessageSchema, OrderMessagesResponseSchema,
  OrderMessageSenderSchema, type SendOrderMessage,
} from '@kantin/shared';
import { Prisma } from './generated/prisma/client.js';
import type { Tx } from './database.js';
import { HttpError } from './errors.js';

const pageSize = 30;
const messageFields = { id:true, sender:true, text:true, createdAt:true } as const;

async function conversation(tx: Tx, id: string, lock = false) {
  const rows = await tx.$queryRaw<{ status: string; sender: string | null; actor_id: string | null }[]>(Prisma.sql`
    SELECT status, app_private.order_chat_role(id) AS sender,
      app_private.ctx_uuid('kantin.actor_id') AS actor_id
    FROM public.orders
    WHERE id = ${id}::uuid
    ${lock ? Prisma.sql`FOR NO KEY UPDATE` : Prisma.empty}
  `);
  const row = rows[0];
  const sender = OrderMessageSenderSchema.safeParse(row?.sender);
  if (!row?.actor_id || !sender.success) throw new HttpError(404, 'Chat pesanan tidak tersedia.');
  return {
    sender: sender.data,
    actorId: row.actor_id,
    closed: row.status === 'selesai' || row.status === 'dibatalkan',
  };
}

function messageDto(row: { id:string; sender:string; text:string; createdAt:Date }) {
  return OrderMessageSchema.parse({
    id: row.id, sender: row.sender, text: row.text, created_at: row.createdAt.toISOString(),
  });
}

export async function listOrderMessages(tx: Tx, orderId: string, cursor?: string) {
  const { closed } = await conversation(tx, orderId);
  const anchor = cursor ? await tx.orderMessage.findUnique({
    where: { orderId_id:{orderId,id:cursor} },
    select: { sequence:true },
  }) : null;
  if (cursor && !anchor) throw new HttpError(404, 'Riwayat chat tidak ditemukan.');

  const rows = await tx.orderMessage.findMany({
    where: { orderId, ...(anchor ? { sequence:{lt:anchor.sequence} } : {}) },
    orderBy: { sequence:'desc' },
    take: pageSize + 1,
    select: messageFields,
  });
  const page = rows.slice(0, pageSize);
  const next_cursor = rows.length > pageSize ? page.at(-1)?.id ?? null : null;
  return OrderMessagesResponseSchema.parse({ data:page.reverse().map(messageDto), next_cursor, closed });
}

export async function sendOrderMessage(tx: Tx, orderId: string, input: SendOrderMessage) {
  // Serialize sends with one another and with the transition to a closed order.
  const { sender, actorId, closed } = await conversation(tx, orderId, true);
  const existing = await tx.orderMessage.findUnique({
    where: { orderId_id:{orderId,id:input.id} },
    select: { ...messageFields, senderId:true },
  });
  if (existing) {
    if (existing.sender !== sender || existing.senderId !== actorId || existing.text !== input.text) {
      throw new HttpError(409, 'ID pesan sudah dipakai untuk kiriman lain.');
    }
    return { created:false, response:OrderMessageResponseSchema.parse({data:messageDto(existing)}) };
  }
  if (closed) throw new HttpError(409, 'Pesanan sudah ditutup. Riwayat chat tetap bisa dibaca.');
  const [{ count } = { count:0 }] = await tx.$queryRaw<{count:number}[]>`
    SELECT count(*)::int AS count
    FROM app_private.order_messages
    WHERE order_id = ${orderId}::uuid AND sender = ${sender}
      AND created_at > clock_timestamp() - interval '1 minute'
  `;
  if (count >= 12) throw new HttpError(429, 'Terlalu banyak pesan. Coba lagi sebentar.');
  const row = await tx.orderMessage.create({
    data: { id:input.id, orderId, sender, senderId:actorId, text:input.text },
    select: messageFields,
  });
  return { created:true, response:OrderMessageResponseSchema.parse({data:messageDto(row)}) };
}
