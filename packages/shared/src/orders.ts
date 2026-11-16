import { z } from 'zod';
import { LIMITS, ORDER_STATUSES, ORDER_TYPES, PAYMENT_METHODS, PAYMENT_STATUSES } from './constants.js';
import { HttpsUrlSchema, IdSchema, MoneySchema, NameSchema, OrderAccessTokenSchema,
  OrderCodeSchema, PaginationQuerySchema, QuantitySchema, TimestampSchema, VersionSchema } from './common.js';

export const OrderStatusSchema = z.enum(ORDER_STATUSES);
export const PaymentStatusSchema = z.enum(PAYMENT_STATUSES);
export const OrderTypeSchema = z.enum(ORDER_TYPES);
export const PaymentMethodSchema = z.enum(PAYMENT_METHODS);
export const OrderItemSchema = z.strictObject({
  id: IdSchema, order_id: IdSchema, tenant_id: IdSchema, menu_id: IdSchema,
  menu_name: NameSchema, qty: QuantitySchema, unit_price: MoneySchema.min(1), subtotal: MoneySchema.min(1),
}).refine((item) => item.subtotal === item.qty * item.unit_price, 'Invalid subtotal');

export const OrderSchema = z.strictObject({
  id: IdSchema, order_code: OrderCodeSchema, tenant_id: IdSchema,
  customer_name: NameSchema, order_type: OrderTypeSchema,
  total: MoneySchema.min(1), status: OrderStatusSchema, payment_status: PaymentStatusSchema,
  payment_method: PaymentMethodSchema,
  payment_confirmed_by: IdSchema.nullable(), payment_confirmed_at: TimestampSchema.nullable(),
  version: VersionSchema, created_at: TimestampSchema, updated_at: TimestampSchema,
}).superRefine((order, ctx) => {
  const validPairs: Record<z.infer<typeof OrderStatusSchema>, readonly z.infer<typeof PaymentStatusSchema>[]> = {
    menunggu_bayar: ['unpaid', 'rejected'], menunggu_konfirmasi: ['pending_confirmation'],
    diproses: ['paid'], siap: ['paid'], selesai: ['paid'], dibatalkan: ['unpaid', 'rejected'],
  };
  if (!validPairs[order.status].includes(order.payment_status)) {
    ctx.addIssue({ code: 'custom', path: ['payment_status'], message: 'Invalid order/payment state pair' });
  }
  const audited = order.payment_confirmed_by !== null && order.payment_confirmed_at !== null;
  const emptyAudit = order.payment_confirmed_by === null && order.payment_confirmed_at === null;
  if ((order.payment_status === 'paid' && !audited) || (order.payment_status !== 'paid' && !emptyAudit)) {
    ctx.addIssue({ code: 'custom', path: ['payment_confirmed_by'], message: 'Invalid payment audit fields' });
  }
});

// Client sends identifiers and quantities only. Prices and tenant grouping are server-owned.
export const CreateOrdersRequestSchema = z.strictObject({
  customer_name: NameSchema, order_type: OrderTypeSchema,
  items: z.array(z.strictObject({ menu_id: IdSchema, qty: QuantitySchema })).min(1).max(LIMITS.maxCartLines),
}).superRefine((cart, ctx) => {
  if (new Set(cart.items.map((item) => item.menu_id)).size !== cart.items.length) {
    ctx.addIssue({ code: 'custom', path: ['items'], message: 'Duplicate menu identifiers' });
  }
});
export const CheckoutHeadersSchema = z.strictObject({ idempotency_key: z.uuid() });
export const OrderAccessHeadersSchema = z.strictObject({ order_access_token: OrderAccessTokenSchema });
export const OrderDetailResponseSchema = z.strictObject({
  data: OrderSchema,
  items: z.array(OrderItemSchema).min(1).max(LIMITS.maxCartLines),
}).superRefine((detail, ctx) => {
  const matches = detail.items.every((item) => item.order_id === detail.data.id && item.tenant_id === detail.data.tenant_id);
  const unique = new Set(detail.items.map((item) => item.menu_id)).size === detail.items.length;
  const total = detail.items.reduce((sum, item) => sum + item.subtotal, 0);
  if (!matches || !unique || total !== detail.data.total) {
    ctx.addIssue({ code: 'custom', path: ['items'], message: 'Invalid order ownership or total' });
  }
});
export const CheckoutOrderSchema = z.strictObject({
  order: OrderSchema, order_access_token: OrderAccessTokenSchema,
  qris: z.strictObject({ image_url: HttpsUrlSchema, merchant_name: z.string().min(2).max(150) }),
});
export const CreateOrdersResponseSchema = z.strictObject({ orders: z.array(CheckoutOrderSchema).min(1).max(LIMITS.maxCartLines) });
export const ReportPaidRequestSchema = z.strictObject({ expected_version: VersionSchema });
export const ConfirmPaymentRequestSchema = z.strictObject({
  expected_version: VersionSchema, decision: z.enum(['accept', 'reject']),
  reason: z.string().trim().min(2).max(300).optional(),
}).refine((request) => request.decision !== 'reject' || request.reason !== undefined, 'Rejection requires a reason');
export const UpdateOrderStatusRequestSchema = z.strictObject({
  expected_version: VersionSchema, status: z.enum(['siap', 'selesai', 'dibatalkan']),
});
export const PaymentInstructionsResponseSchema = z.strictObject({
  order_id: IdSchema, total: MoneySchema.min(1),
  qris: z.strictObject({ image_url: HttpsUrlSchema, merchant_name: z.string().min(2).max(150) }),
});
export const AdminOrderQuerySchema = PaginationQuerySchema.extend({
  tenant_id: IdSchema.optional(), status: OrderStatusSchema.optional(), payment_status: PaymentStatusSchema.optional(),
});
export const AdminOrderListResponseSchema = z.strictObject({ data: z.array(OrderSchema), next_cursor: IdSchema.nullable() });
export const TrackerTokenResponseSchema = z.strictObject({
  access_token: z.string().min(1).max(8192), expires_at: TimestampSchema, order_id: IdSchema,
});
export type Order = z.infer<typeof OrderSchema>;
export type OrderItem = z.infer<typeof OrderItemSchema>;
export type OrderStatus = z.infer<typeof OrderStatusSchema>;
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;
export type CreateOrdersRequest = z.infer<typeof CreateOrdersRequestSchema>;
export type CreateOrdersResponse = z.infer<typeof CreateOrdersResponseSchema>;
