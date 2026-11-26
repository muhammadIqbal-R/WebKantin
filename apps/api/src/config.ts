import { z } from 'zod';
export const ConfigSchema = z.object({
  DATABASE_URL: z.string().startsWith('postgresql://'),
  SUPABASE_URL: z.url({ protocol: /^https$/ }),
  SUPABASE_SECRET_KEY: z.string().min(1).optional(),
  IDEMPOTENCY_ENCRYPTION_KEY:z.string().optional(),
  API_RATE_LIMIT_PER_MINUTE:z.coerce.number().int().min(60).max(60000).default(3600),
  UNPAID_ORDER_TTL_MINUTES:z.coerce.number().int().min(5).max(120).default(15),
  WEB_USER_ORIGIN: z.url(), WEB_ADMIN_ORIGIN: z.url(),
  WEB_TENANT_ORIGIN: z.url().optional(),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
});
export type Config = z.infer<typeof ConfigSchema>;
