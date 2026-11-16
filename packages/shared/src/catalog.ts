import { z } from 'zod';
import { HttpsUrlSchema, IdSchema, MoneySchema, NameSchema, PaginationQuerySchema, TimestampSchema } from './common.js';

const NonEmptyPatch = (value: object) => Object.keys(value).length > 0;
export const OutletInputSchema = z.strictObject({
  name: NameSchema, location: z.string().trim().min(2).max(300),
  floor_map_url: HttpsUrlSchema.nullable(),
});
export const OutletSchema = OutletInputSchema.extend({
  id: IdSchema, is_active: z.boolean(), created_at: TimestampSchema, updated_at: TimestampSchema,
});
export const CreateOutletRequestSchema = OutletInputSchema;
export const UpdateOutletRequestSchema = OutletInputSchema.partial().extend({ is_active: z.boolean().optional() })
  .refine(NonEmptyPatch, 'At least one field is required');

export const TenantInputSchema = z.strictObject({
  outlet_id: IdSchema, name: NameSchema,
  description: z.string().trim().max(1000),
  qris_image_url: HttpsUrlSchema.nullable(),
  qris_merchant_name: z.string().trim().min(2).max(150).nullable(),
});
export const TenantSchema = TenantInputSchema.extend({
  id: IdSchema, is_active: z.boolean(), created_at: TimestampSchema, updated_at: TimestampSchema,
});
export const CreateTenantRequestSchema = TenantInputSchema;
export const UpdateTenantRequestSchema = TenantInputSchema.partial().extend({ is_active: z.boolean().optional() })
  .refine(NonEmptyPatch, 'At least one field is required');

export const MenuInputSchema = z.strictObject({
  name: NameSchema, price: MoneySchema.min(1), photo_url: HttpsUrlSchema.nullable(),
  is_available: z.boolean(),
});
export const MenuSchema = MenuInputSchema.extend({
  id: IdSchema, tenant_id: IdSchema, is_active: z.boolean(),
  created_at: TimestampSchema, updated_at: TimestampSchema,
});
export const CreateMenuRequestSchema = MenuInputSchema.extend({ tenant_id: IdSchema });
export const UpdateMenuRequestSchema = MenuInputSchema.partial()
  .refine(NonEmptyPatch, 'At least one field is required');

export const TenantListQuerySchema = PaginationQuerySchema.extend({ outlet_id: IdSchema.optional() });
export const AdminMenuQuerySchema = PaginationQuerySchema.extend({ tenant_id: IdSchema.optional() });

export const TenantListResponseSchema = z.strictObject({ data: z.array(TenantSchema), next_cursor: IdSchema.nullable() });
export const MenuListResponseSchema = z.strictObject({ data: z.array(MenuSchema), next_cursor: IdSchema.nullable() });
export const OutletListResponseSchema = z.strictObject({ data: z.array(OutletSchema), next_cursor: IdSchema.nullable() });
export type Tenant = z.infer<typeof TenantSchema>;
export type Menu = z.infer<typeof MenuSchema>;
export type Outlet = z.infer<typeof OutletSchema>;
export type CreateTenantRequest = z.infer<typeof CreateTenantRequestSchema>;
export type CreateMenuRequest = z.infer<typeof CreateMenuRequestSchema>;
