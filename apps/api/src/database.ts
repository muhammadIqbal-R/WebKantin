import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from './generated/prisma/client.js';
import { UserSchema, type User } from '@kantin/shared';
import { HttpError } from './errors.js';
export type Tx = Prisma.TransactionClient;
export function userDto(row: {id:string; role:string; tenantId:string|null; email:string; isActive:boolean; createdAt:Date; updatedAt:Date}) {
  return UserSchema.parse({id:row.id, role:row.role, tenant_id:row.tenantId, email:row.email, is_active:row.isActive, created_at:row.createdAt.toISOString(), updated_at:row.updatedAt.toISOString()});
}
export class Database {
  readonly client: PrismaClient;
  constructor(url: string, private readonly unpaidTtlMinutes = 15) {
    this.client = new PrismaClient({ adapter: new PrismaPg({connectionString:url}) });
  }
  async expireOrders() {
    await this.client.$queryRaw`SELECT app_private.expire_unpaid_orders()`;
  }
  async checkRuntime() {
    const rows = await this.client.$queryRaw<{rolname:string; rolsuper:boolean; rolbypassrls:boolean}[]>`SELECT rolname,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user`;
    const role = rows[0];
    if (!role || role.rolname !== 'kantin_api' || role.rolsuper || role.rolbypassrls) throw new Error('API requires the limited kantin_api database role');
    const migration=await this.client.$queryRaw<{ready:boolean}[]>`
      SELECT to_regprocedure('app_private.auth_account_active(uuid)') IS NOT NULL
        AND to_regprocedure('app_private.expire_unpaid_orders()') IS NOT NULL
        AND to_regclass('app_private.order_fulfillment_details') IS NOT NULL
        AND to_regclass('app_private.order_payment_proofs') IS NOT NULL AS ready
    `;
    if(!migration[0]?.ready)throw new Error('Apply tenant-payment-proofs-upgrade.sql and its prerequisites before starting this API');
  }
  async staff<T>(sub: string, requestId: string, work: (tx: Tx, actor: User) => Promise<T>): Promise<T> {
    return this.client.$transaction(async tx => {
      await tx.$queryRaw`SELECT set_config('kantin.actor_kind','staff',true), set_config('kantin.actor_id',${sub},true), set_config('kantin.request_id',${requestId},true)`;
      const row = await tx.user.findUnique({where:{id:sub}});
      if (!row?.isActive) throw new HttpError(403, 'Akun pengelola tidak aktif atau belum diberi akses.');
      const active=await tx.$queryRaw<{active:boolean}[]>`SELECT app_private.auth_account_active(${sub}::uuid) AS active`;
      if(!active[0]?.active)throw new HttpError(403,'Akun pengelola dinonaktifkan.');
      return work(tx, userDto(row));
    });
  }
  async catalog<T>(requestId:string,work:(tx:Tx)=>Promise<T>):Promise<T>{
    return this.client.$transaction(async tx=>{await tx.$queryRaw`SELECT set_config('kantin.actor_kind','public',true), set_config('kantin.request_id',${requestId},true)`;return work(tx);});
  }
  async customer<T>(sub:string,requestId:string,work:(tx:Tx)=>Promise<T>):Promise<T>{
    return this.client.$transaction(async tx=>{
      await tx.$queryRaw`SELECT set_config('kantin.actor_kind','customer_account',true),set_config('kantin.actor_id',${sub},true),set_config('kantin.request_id',${requestId},true)`;
      const active=await tx.$queryRaw<{active:boolean}[]>`SELECT app_private.auth_account_active(${sub}::uuid) AS active`;
      if(!active[0]?.active)throw new HttpError(403,'Akun pelanggan tidak aktif.');return work(tx);
    });
  }
  async checkout<T>(sub:string,key:string,hash:string,requestId:string,work:(tx:Tx)=>Promise<T>):Promise<T>{
    return this.client.$transaction(async tx=>{
      await tx.$queryRaw`SELECT set_config('kantin.actor_kind','checkout',true),set_config('kantin.customer_id',${sub},true),set_config('kantin.checkout_id',${key},true),set_config('kantin.request_hash',${hash},true),set_config('kantin.request_id',${requestId},true)`;
      await tx.$queryRaw`SELECT set_config('kantin.unpaid_ttl_minutes',${String(this.unpaidTtlMinutes)},true)`;
      const active=await tx.$queryRaw<{active:boolean}[]>`SELECT app_private.auth_account_active(${sub}::uuid) AS active`;
      if(!active[0]?.active)throw new HttpError(403,'Akun pelanggan tidak aktif.');return work(tx);
    },{timeout:10000});
  }
}
