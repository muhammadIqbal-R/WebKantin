import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {makeDatabase,readSql,baselineUrl,seedUrl,transact} from './sql-support.mjs';
import {OrderSchema} from '@kantin/shared';
let db;const admin=randomUUID(),staffA=randomUUID(),staffB=randomUUID(),customerA=randomUUID(),customerB=randomUUID(),A='20000000-0000-4000-8000-000000000001',B=randomUUID(),M='40000000-0000-4000-8000-000000000001',MB=randomUUID();let orderA,orderB;
const context=()=>({'kantin.request_id':randomUUID()});const staff=id=>({...context(),'kantin.actor_kind':'staff','kantin.actor_id':id});const customer=id=>({...context(),'kantin.actor_kind':'customer_account','kantin.actor_id':id});const owner=fn=>transact(db,'owner',{...context(),'kantin.actor_kind':'maintenance'},fn);
async function create(buyer,lines){const key=randomUUID(),hash='a'.repeat(64);return transact(db,'api',{...context(),'kantin.actor_kind':'checkout','kantin.customer_id':buyer,'kantin.checkout_id':key,'kantin.request_hash':hash},async sql=>{
 await sql.query('INSERT INTO app_private.checkout_requests(idempotency_key,request_hash) VALUES($1,$2)',[key,hash]);const orders=[];
 for(const {tenant,menu,qty} of lines){const price=(await sql.query('SELECT price FROM public.menus WHERE id=$1',[menu])).rows[0].price;const row=(await sql.query("INSERT INTO public.orders(tenant_id,customer_name,order_type,total) VALUES($1,'Pemesan uji','take_away',$2) RETURNING *",[tenant,qty*price])).rows[0];await sql.query("INSERT INTO public.order_items(order_id,tenant_id,menu_id,menu_name,qty,unit_price,subtotal) VALUES($1,$2,$3,'server snapshot',$4,1,1)",[row.id,tenant,menu,qty]);await sql.query('INSERT INTO app_private.order_access_grants(order_id,tenant_id,token_digest) VALUES($1,$2,$3)',[row.id,tenant,createHash('sha256').update(randomBytes(32)).digest('hex')]);orders.push(row);}
 await sql.query('UPDATE app_private.checkout_requests SET response_ciphertext=$2 WHERE idempotency_key=$1',[key,'v1:'+randomBytes(48).toString('base64url')]);return orders;
});}
const rt=id=>({'request.jwt.claims':JSON.stringify({sub:id,role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+300})});
before(async()=>{db=await makeDatabase();await db.exec(await readSql(baselineUrl));await db.exec(await readSql(seedUrl));await db.exec(await readSql(new URL('../prisma/migrations/202611200001_management/migration.sql',import.meta.url)));await db.exec(await readSql(new URL('../prisma/migrations/202611210001_orders/migration.sql',import.meta.url)));await owner(async sql=>{
 for(const id of [admin,staffA,staffB,customerA,customerB])await sql.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[id,id+'@example.test']);
 const outlet=(await sql.query('SELECT outlet_id FROM public.tenants WHERE id=$1',[A])).rows[0].outlet_id;
 await sql.query("INSERT INTO public.tenants(id,outlet_id,name,qris_image_url,qris_merchant_name,is_active) VALUES($1,$2,'Tenant B','https://qa.supabase.co/qris-b.webp','B merchant',true)",[B,outlet]);await sql.query("UPDATE public.tenants SET qris_image_url='https://qa.supabase.co/qris-a.webp',qris_merchant_name='A merchant',is_active=true WHERE id=$1",[A]);
 await sql.query("INSERT INTO app_private.users(id,email,role,tenant_id) VALUES($1,'admin@example.test','admin_pengelola',null),($2,'a@example.test','tenant',$4),($3,'b@example.test','tenant',$5)",[admin,staffA,staffB,A,B]);
 await sql.query('UPDATE public.menus SET stock=10,is_available=true WHERE id=$1',[M]);await sql.query("INSERT INTO public.menus(id,tenant_id,name,price,stock,is_available) VALUES($1,$2,'Menu B',12000,10,true)",[MB,B]);
});});
after(async()=>{await db?.close();});
test('checkout binds authenticated owner and reserves actual inventory',async()=>{[orderA]=await create(customerA,[{tenant:A,menu:M,qty:2}]);[orderB]=await create(customerB,[{tenant:B,menu:MB,qty:3}]);assert.equal(orderA.customer_id,customerA);assert.equal((await db.query('SELECT stock FROM public.menus WHERE id=$1',[M])).rows[0].stock,8);});
test('account API and authenticated RLS isolate customer A/B and tenant A/B even under a broad permissive policy',async()=>{
 await db.exec('CREATE POLICY test_broad_read ON public.orders FOR SELECT TO authenticated USING(true)');
 for(const [id,expected] of [[customerA,orderA.id],[customerB,orderB.id],[staffA,orderA.id],[staffB,orderB.id]])await transact(db,'authenticated',rt(id),async sql=>{assert.deepEqual((await sql.query('SELECT id FROM public.orders ORDER BY id')).rows.map(row=>row.id),[expected]);});
 await transact(db,'api',customer(customerA),async sql=>{assert.equal((await sql.query('SELECT id FROM public.orders WHERE id=$1',[orderB.id])).rows.length,0);});
 await assert.rejects(()=>transact(db,'anon',{},sql=>sql.query('SELECT id FROM public.orders')));
});
test('owner can claim but cannot self-accept; tenant A cannot change tenant B order',async()=>{
 await transact(db,'api',{...customer(customerA),'kantin.expected_version':1},sql=>sql.query("UPDATE public.orders SET status='menunggu_konfirmasi' WHERE id=$1",[orderA.id]));
 await assert.rejects(()=>transact(db,'api',{...customer(customerA),'kantin.expected_version':2},sql=>sql.query("UPDATE public.orders SET status='diproses' WHERE id=$1",[orderA.id])));
 await transact(db,'api',{...staff(staffA),'kantin.expected_version':1},async sql=>{assert.equal((await sql.query("UPDATE public.orders SET status='dibatalkan' WHERE id=$1 RETURNING id",[orderB.id])).rows.length,0);});
});
test('rejection keeps reservation, cancellation restores once, and illegal rewrites roll back',async()=>{
 await transact(db,'api',{...staff(staffA),'kantin.expected_version':2,'kantin.rejection_reason':'Mutasi belum ditemukan'},sql=>sql.query("UPDATE public.orders SET status='menunggu_bayar' WHERE id=$1",[orderA.id]));assert.equal((await db.query('SELECT stock FROM public.menus WHERE id=$1',[M])).rows[0].stock,8);
 for(const [id,expected] of [[customerA,[{reason:'Mutasi belum ditemukan'}]],[customerB,[]]]){
  await transact(db,'api',customer(id),async sql=>{
   const result=await sql.query("SELECT reason FROM app_private.order_events WHERE order_id=$1 AND action='payment_rejected'",[orderA.id]);
   assert.deepEqual(result.rows,expected);
  });
 }
 await transact(db,'api',{...staff(staffA),'kantin.expected_version':3},sql=>sql.query("UPDATE public.orders SET status='dibatalkan' WHERE id=$1",[orderA.id]));assert.equal((await db.query('SELECT stock FROM public.menus WHERE id=$1',[M])).rows[0].stock,10);
 await assert.rejects(()=>transact(db,'api',{...staff(staffA),'kantin.expected_version':4},sql=>sql.query("UPDATE public.orders SET status='dibatalkan' WHERE id=$1",[orderA.id])));assert.equal((await db.query('SELECT stock FROM public.menus WHERE id=$1',[M])).rows[0].stock,10);
});
test('insufficient second tenant stock rolls back first tenant reservation and all orders',async()=>{const count=(await db.query('SELECT count(*) AS n FROM public.orders')).rows[0].n;await assert.rejects(()=>create(customerA,[{tenant:A,menu:M,qty:1},{tenant:B,menu:MB,qty:99}]));assert.equal((await db.query('SELECT count(*) AS n FROM public.orders')).rows[0].n,count);assert.equal((await db.query('SELECT stock FROM public.menus WHERE id=$1',[M])).rows[0].stock,10);});
test('acceptance audits actor; paid cannot cancel; banned and expired accounts lose realtime reads',async()=>{
 await transact(db,'api',{...customer(customerB),'kantin.expected_version':1},sql=>sql.query("UPDATE public.orders SET status='menunggu_konfirmasi' WHERE id=$1",[orderB.id]));await transact(db,'api',{...staff(staffB),'kantin.expected_version':2},sql=>sql.query("UPDATE public.orders SET status='diproses' WHERE id=$1",[orderB.id]));const row=(await db.query('SELECT * FROM public.orders WHERE id=$1',[orderB.id])).rows[0];assert.equal(row.payment_confirmed_by,staffB);assert.equal(row.payment_status,'paid');
 await assert.rejects(()=>transact(db,'api',{...staff(staffB),'kantin.expected_version':3},sql=>sql.query("UPDATE public.orders SET status='dibatalkan' WHERE id=$1",[orderB.id])));
 await db.query("UPDATE auth.users SET banned_until=now()+interval '1 hour' WHERE id=$1",[customerB]);await transact(db,'authenticated',rt(customerB),async sql=>assert.equal((await sql.query('SELECT id FROM public.orders')).rows.length,0));
 await transact(db,'authenticated',{'request.jwt.claims':JSON.stringify({sub:customerA,role:'authenticated',aud:'authenticated',exp:1})},async sql=>assert.equal((await sql.query('SELECT id FROM public.orders')).rows.length,0));
});
test('cancellation restores an archived tenant inventory without reopening it',async()=>{const [order]=await create(customerA,[{tenant:A,menu:M,qty:1}]);await transact(db,'api',staff(admin),sql=>sql.query('UPDATE public.tenants SET archived_at=now() WHERE id=$1',[A]));await transact(db,'api',{...staff(staffA),'kantin.expected_version':1},sql=>sql.query("UPDATE public.orders SET status='dibatalkan' WHERE id=$1",[order.id]));const menu=(await db.query('SELECT stock,is_available FROM public.menus WHERE id=$1',[M])).rows[0];assert.deepEqual(menu,{stock:10,is_available:false});});
test('notification projection preserves valid timestamp precision and hides customer identity linkage',async()=>{const row=(await db.query("SELECT to_jsonb(o)-'customer_id' AS data FROM public.orders o ORDER BY updated_at,id LIMIT 1")).rows[0];assert.equal('customer_id'in row.data,false);assert.equal(OrderSchema.safeParse(row.data).success,true);});
test('outlet changes are admin-only and an outlet with active tenants cannot be hidden',async()=>{
 const id=randomUUID();
 await transact(db,'api',staff(admin),sql=>sql.query("INSERT INTO public.outlets(id,name,location,is_active) VALUES($1,'Outlet uji','Lantai dasar',false)",[id]));
 await transact(db,'api',{'kantin.actor_kind':'public'},async sql=>{
  assert.equal((await sql.query('SELECT id FROM public.outlets WHERE id=$1',[id])).rows.length,0);
 });
 await transact(db,'api',staff(staffB),async sql=>{
  assert.equal((await sql.query("UPDATE public.outlets SET name='Akses di luar scope' RETURNING id")).rows.length,0);
 });
 await transact(db,'api',staff(admin),sql=>sql.query("UPDATE public.outlets SET is_active=true WHERE id=$1",[id]));
 await transact(db,'api',{'kantin.actor_kind':'public'},async sql=>{
  assert.equal((await sql.query('SELECT id FROM public.outlets WHERE id=$1',[id])).rows.length,1);
 });
 const occupied=(await db.query('SELECT outlet_id FROM public.tenants WHERE id=$1',[B])).rows[0].outlet_id;
 await assert.rejects(()=>transact(db,'api',staff(admin),sql=>sql.query('UPDATE public.outlets SET is_active=false WHERE id=$1',[occupied])),{code:'23514'});
});
test('first administrator bootstrap needs one Auth account, no tenant account and does not publish credentials',async()=>{const isolated=await makeDatabase();try{await isolated.exec(await readSql(baselineUrl));await isolated.exec(await readSql(seedUrl));const id=randomUUID();await isolated.query("INSERT INTO auth.users(id,email) VALUES($1,'owner@example.test')",[id]);const script=(await readSql(new URL('../../../infra/supabase/bootstrap-admin.example.sql',import.meta.url))).replace('REPLACE_ADMIN_EMAIL','owner@example.test').replace('REPLACE_FIRST_SETUP_PASSWORD',randomBytes(24).toString('base64'));await isolated.exec(script);assert.deepEqual((await isolated.query('SELECT id,role,tenant_id FROM app_private.users')).rows,[{id,role:'admin_pengelola',tenant_id:null}]);assert.equal((await isolated.query("SELECT rolcanlogin FROM pg_roles WHERE rolname='kantin_api'")).rows[0].rolcanlogin,true);}finally{await isolated.close();}});
