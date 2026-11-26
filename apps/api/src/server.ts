import { loadEnvFile } from 'node:process';
import { ConfigSchema } from './config.js';
import { Database } from './database.js';
import { Accounts } from './accounts.js';
import { createVerifier } from './auth.js';
import { createApp } from './app.js';
import { Media } from './media.js';
import {ReplayCipher} from './replay.js';
try {loadEnvFile('.env');} catch(error:unknown) {if(!(error instanceof Error && 'code' in error && error.code==='ENOENT'))throw error;}
const config=ConfigSchema.safeParse(process.env);
if(!config.success) {console.error('API configuration incomplete. Check apps/api/.env.example.');process.exit(1);}
const env=config.data;
const db=new Database(env.DATABASE_URL,env.UNPAID_ORDER_TTL_MINUTES);
try {await db.checkRuntime();} catch {console.error('API database unavailable, runtime role invalid, or SQL upgrades missing. Check tenant-payment-proofs-upgrade.sql.');await db.client.$disconnect();process.exit(1);}
const origins = [env.WEB_ADMIN_ORIGIN, env.WEB_USER_ORIGIN, ...(env.WEB_TENANT_ORIGIN ? [env.WEB_TENANT_ORIGIN] : [])];
const app=createApp({db,rateLimitPerMinute:env.API_RATE_LIMIT_PER_MINUTE,cipher:new ReplayCipher(env.IDEMPOTENCY_ENCRYPTION_KEY),media:new Media(env.SUPABASE_URL,env.SUPABASE_SECRET_KEY),accounts:new Accounts(env.SUPABASE_URL,env.SUPABASE_SECRET_KEY,env.WEB_TENANT_ORIGIN??env.WEB_ADMIN_ORIGIN),verify:createVerifier(env.SUPABASE_URL),origins});
const server=app.listen(env.PORT,()=>console.info(`Kantin API listening on port ${env.PORT}`));
let expiryRunning=false;
async function expireOrders(){
  if(expiryRunning)return;
  expiryRunning=true;
  try{await db.expireOrders();}catch{console.error('Order expiry check failed. Verify the order operations SQL upgrade.');}
  finally{expiryRunning=false;}
}
const expiryTimer=setInterval(()=>void expireOrders(),15000);
expiryTimer.unref();
void expireOrders();
for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>{
  clearInterval(expiryTimer);
  server.close(()=>{void db.client.$disconnect().then(()=>process.exit(0));});
});
