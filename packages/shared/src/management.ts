import { z } from 'zod';
import { IdSchema, NameSchema, TimestampSchema, VersionSchema, PaginationQuerySchema, HttpsUrlSchema } from './common.js';
import { CreateMenuRequestSchema, MenuInputSchema, MenuSchema, TenantSchema, UpdateMenuRequestSchema, UpdateTenantRequestSchema } from './catalog.js';

export const StockSchema = z.number().int().min(0).max(1_000_000);
export const DEFAULT_MENU_CATEGORIES = ['Makanan', 'Minuman', 'Camilan'] as const;
export const MAX_MENU_CATEGORY_LENGTH = 40;
export const MenuCategorySchema = z.string().trim().min(1).max(MAX_MENU_CATEGORY_LENGTH).regex(/^[^\p{Cc}]+$/u);
export const MenuPriceInputSchema = z.string().trim()
  .regex(/^(?:[0-9]+|[1-9][0-9]{0,2}(?:\.[0-9]{3})+)$/)
  .transform(value => Number(value.replaceAll('.', '')))
  .pipe(MenuInputSchema.shape.price);

export function menuCategoryKey(label: string) {
  return label.toLocaleLowerCase('id');
}

export function collectMenuCategories(labels: Iterable<string>) {
  const categories = new Map<string, string>();
  for (const label of labels) {
    const key = menuCategoryKey(label);
    if (!categories.has(key)) categories.set(key, label);
  }
  return categories;
}
const metadata = { category: MenuCategorySchema, description: z.string().trim().max(250) };
export const ManagedMenuSchema = MenuSchema.extend({ ...metadata, stock: StockSchema, stock_version: VersionSchema });
export const ManagedMenuCreateSchema = CreateMenuRequestSchema.extend({ ...metadata, stock: StockSchema });
export const ManagedMenuPatchSchema = UpdateMenuRequestSchema.safeExtend({ category: MenuCategorySchema.optional(), description: metadata.description.optional() });
export const StockUpdateSchema = z.strictObject({ stock: StockSchema, expected_version: VersionSchema });
export const ManagedTenantSchema = TenantSchema.extend({ archived_at: TimestampSchema.nullable(), qris_preview_url: HttpsUrlSchema.nullable().optional() });
export const ManagedTenantResponseSchema = z.strictObject({ data: ManagedTenantSchema });
export const ManagedMenuResponseSchema = z.strictObject({ data: ManagedMenuSchema });
export const ManagedTenantPatchSchema = UpdateTenantRequestSchema.safeExtend({ archived: z.boolean().optional() });
export const ManagementQuerySchema = PaginationQuerySchema.extend({ tenant_id: IdSchema.optional() });
export const ManagedMenusResponseSchema = z.strictObject({ data: z.array(ManagedMenuSchema), next_cursor: IdSchema.nullable() });
export const CatalogStockResponseSchema = z.strictObject({
  data:z.array(ManagedMenuSchema.pick({id:true,stock:true,is_available:true})),
  next_cursor:IdSchema.nullable(),
});
export const ManagedTenantsResponseSchema = z.strictObject({ data: z.array(ManagedTenantSchema), next_cursor: IdSchema.nullable() });
export const ManagedUserSchema = z.strictObject({ id: IdSchema, email: z.email(), name: NameSchema.nullable(), role: z.enum(['admin_pengelola', 'tenant', 'pelanggan']), tenant_id: IdSchema.nullable(), is_active: z.boolean(), created_at: TimestampSchema });
export const ManagedUsersQuerySchema = z.strictObject({ page: z.string().regex(/^[1-9][0-9]{0,4}$/).transform(Number).default(1) });
export const ManagedUsersResponseSchema = z.strictObject({ data: z.array(ManagedUserSchema), next_page: z.number().int().positive().nullable() });
export const UserStatusSchema = z.strictObject({ is_active: z.boolean() });
export const UserStatusResponseSchema = z.strictObject({ data: UserStatusSchema.extend({id:IdSchema}) });
export const HealthSchema = z.strictObject({ status: z.literal('ok') });
export type ManagedMenu = z.infer<typeof ManagedMenuSchema>;
export type ManagedTenant = z.infer<typeof ManagedTenantSchema>;
export type ManagedUser = z.infer<typeof ManagedUserSchema>;
