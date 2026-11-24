import { z } from 'zod';
import { IdSchema, TimestampSchema } from './common.js';

export const ORDER_MESSAGE_MAX = 1000;
export const OrderMessageSenderSchema = z.enum(['pelanggan', 'tenant']);
const messageText = z.string().trim().min(1).max(ORDER_MESSAGE_MAX);

export const SendOrderMessageSchema = z.strictObject({ id: IdSchema, text: messageText });
export const OrderMessageSchema = SendOrderMessageSchema.extend({
  sender: OrderMessageSenderSchema,
  created_at: TimestampSchema,
});
export const OrderMessagesQuerySchema = z.strictObject({ cursor: IdSchema.optional() });
export const OrderMessageResponseSchema = z.strictObject({ data: OrderMessageSchema });
export const OrderMessagesResponseSchema = z.strictObject({
  data: z.array(OrderMessageSchema).max(30),
  next_cursor: IdSchema.nullable(),
  closed: z.boolean(),
});

export type SendOrderMessage = z.infer<typeof SendOrderMessageSchema>;
export type OrderMessage = z.infer<typeof OrderMessageSchema>;
export type OrderMessageSender = z.infer<typeof OrderMessageSenderSchema>;
export type OrderMessagesResponse = z.infer<typeof OrderMessagesResponseSchema>;
