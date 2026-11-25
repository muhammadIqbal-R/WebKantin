import { z } from 'zod';
import { IdSchema, MoneySchema, OrderCodeSchema, TimestampSchema, VersionSchema } from './common.js';

export const PaymentWindowSchema = z.strictObject({
  deadline_at:z.iso.datetime(),
  expired_at:TimestampSchema.nullable(),
});

const reason = z.string().trim().min(2).max(300);
export const RefundStatusSchema = z.enum(['diminta','diproses','ditolak','dikembalikan']);
export const RequestRefundSchema = z.strictObject({ reason });
export const UpdateRefundSchema = z.discriminatedUnion('action', [
  z.strictObject({ action:z.literal('take'), expected_version:VersionSchema }),
  z.strictObject({ action:z.literal('reject'), expected_version:VersionSchema, note:reason }),
  z.strictObject({ action:z.literal('complete'), expected_version:VersionSchema, transfer_ref:z.string().trim().min(2).max(100) }),
]);
export const OrderRefundSchema = z.strictObject({
  source:z.enum(['paid','expired_claim']),
  amount:MoneySchema.min(1),
  reason,
  status:RefundStatusSchema,
  version:VersionSchema,
  can_complete:z.boolean(),
  resolution_note:reason.nullable(),
  created_at:TimestampSchema,
  resolved_at:TimestampSchema.nullable(),
});
export const OrderRefundResponseSchema = z.strictObject({ data:OrderRefundSchema });

export const MarkChatReadSchema = z.strictObject({ message_id:IdSchema });
export const MarkChatReadResponseSchema = z.null();
export const ChatInboxSchema = z.strictObject({
  unread:z.number().int().nonnegative(),
  data:z.array(z.strictObject({
    order_id:IdSchema,
    order_code:OrderCodeSchema,
    unread:z.number().int().positive(),
  })).max(30),
});
export type OrderRefund = z.infer<typeof OrderRefundSchema>;
export type UpdateRefund = z.infer<typeof UpdateRefundSchema>;
