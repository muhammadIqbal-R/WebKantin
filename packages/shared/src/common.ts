import { z } from 'zod';
import { LIMITS } from './constants.js';

export const IdSchema = z.uuid();
export const TimestampSchema = z.iso.datetime({ offset: true });
export const MoneySchema = z.number().int().min(0).max(LIMITS.maxMoneyIdr);
export const QuantitySchema = z.number().int().min(1).max(LIMITS.maxQuantity);
export const HttpsUrlSchema = z.url({ protocol: /^https$/ }).max(2048);
export const NameSchema = z.string().trim().min(2).max(100);
export const OrderCodeSchema = z.string().regex(/^KT-[A-Z0-9]{10}$/);
export const OrderAccessTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const VersionSchema = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
export const VersionRequestSchema = z.strictObject({ expected_version: VersionSchema });
export const PaginationQuerySchema = z.strictObject({
  cursor: IdSchema.optional(),
  limit: z.string().regex(/^[1-9][0-9]{0,2}$/).transform(Number)
    .pipe(z.number().int().max(LIMITS.maxPageSize)).default(20),
});
export const IdParamsSchema = z.strictObject({ id: IdSchema });
export const TenantParamsSchema = z.strictObject({ tenant_id: IdSchema });
export const OrderCodeParamsSchema = z.strictObject({ code: OrderCodeSchema });
export const EmptyBodySchema = z.strictObject({});
export const ApiErrorSchema = z.strictObject({
  error: z.strictObject({
    code: z.enum(['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND',
      'CONFLICT', 'RATE_LIMITED', 'INTERNAL_ERROR']),
    message: z.string().max(300),
    request_id: z.uuid(),
    issues: z.array(z.strictObject({ path: z.array(z.union([z.string(), z.number()])), message: z.string() })).optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
