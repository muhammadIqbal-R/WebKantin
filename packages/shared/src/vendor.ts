import {z} from 'zod';
import {IdSchema,TimestampSchema} from './common.js';
import {OrderSchema,OrderDetailResponseSchema} from './orders.js';
export const VENDOR_CATALOG=[
  {name:'Tens',description:'Kopi dan minuman',menus:[{name:'Americano',price:12000,category:'Minuman'},{name:'Karambol',price:23000,category:'Minuman'},{name:'Matcha Latte',price:18000,category:'Minuman'}]},
  {name:'Mie Ayam',description:'Mie dan pelengkap',menus:[{name:'Mie Yamin',price:12000,category:'Makanan'},{name:'Pangsit Rebus',price:5000,category:'Makanan'},{name:'Bakso Keju',price:10000,category:'Makanan'}]},
  {name:'Bento',description:'Paket bento',menus:[{name:'Paket A',price:23000,category:'Makanan'},{name:'Paket B',price:25000,category:'Makanan'},{name:'Paket C',price:28000,category:'Makanan'}]},
] as const;
export const VendorImportRequestSchema=z.strictObject({catalog_id:z.literal('vendor-2026-11-21'),outlet_id:IdSchema});
export const VendorImportResponseSchema=z.strictObject({data:z.strictObject({created_tenants:z.number().int().nonnegative(),created_menus:z.number().int().nonnegative(),skipped_menus:z.number().int().nonnegative()})});
export const ExistingTenantAccountSchema=z.strictObject({user_id:IdSchema,tenant_id:IdSchema});
export const OrderResponseSchema=z.strictObject({data:OrderSchema});
export const OwnedOrdersResponseSchema=z.strictObject({data:z.array(OrderDetailResponseSchema),next_cursor:IdSchema.nullable()});
export const OrderFeedCursorSchema=z.strictObject({updated_at:TimestampSchema,id:IdSchema});
export const OrderFeedQuerySchema=z.strictObject({cursor:z.string().regex(/^[A-Za-z0-9_-]+$/).max(300).optional()});
export const OrderNotificationFeedSchema=z.strictObject({data:z.array(OrderSchema),next_cursor:z.string().min(1).max(300),has_more:z.boolean()});
// Project a database event to non-sensitive invalidation fields; ignore other row columns.
export const OrderSignalSchema=z.object({id:IdSchema,tenant_id:IdSchema,status:z.enum(['menunggu_bayar','menunggu_konfirmasi','diproses','siap','selesai','dibatalkan']),version:z.number().int().positive()});
export const PasswordSetupSchema=z.strictObject({password:z.string().min(8).max(128)});
