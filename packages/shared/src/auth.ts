import { z } from 'zod';
import { ROLES } from './constants.js';
import { IdSchema, TimestampSchema } from './common.js';

export const RoleSchema = z.enum(ROLES);
export const UserSchema = z.strictObject({
  id: IdSchema, role: RoleSchema, tenant_id: IdSchema.nullable(), email: z.email(),
  is_active: z.boolean(), created_at: TimestampSchema, updated_at: TimestampSchema,
}).refine((user) => user.role === 'tenant' ? user.tenant_id !== null : user.tenant_id === null,
  'Role and tenant scope do not match');
export const CreateTenantAccountRequestSchema = z.strictObject({ tenant_id: IdSchema, email: z.string().trim().toLowerCase().max(320).pipe(z.email()) });
export const MeResponseSchema = z.strictObject({ data: UserSchema });
export type User = z.infer<typeof UserSchema>;
export type Role = z.infer<typeof RoleSchema>;

export const CustomerSignInSchema = z.strictObject({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1).max(128),
});
export const CustomerSignUpSchema = z.strictObject({
  display_name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(8).max(128),
  password_confirmation: z.string().min(8).max(128),
}).refine((value) => value.password === value.password_confirmation, {
  path: ['password_confirmation'], message: 'Password confirmation does not match',
});
