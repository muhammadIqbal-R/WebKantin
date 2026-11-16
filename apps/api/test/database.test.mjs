import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { OrderSchema } from '@kantin/shared';
import { makeDatabase, readSql, baselineUrl, seedUrl, transact } from './sql-support.mjs';
let db; let a; let b; let initialCounts;
const A='20000000-0000-4000-8000-000000000001';
const B='20000000-0000-4000-8000-000000000002';
const M='40000000-0000-4000-8000-000000000001';
const MB='40000000-0000-4000-8000-000000000099';
const admin=randomUUID(), userA=randomUUID(), userB=randomUUID();
const sha=(text)=>createHash('sha256').update(text).digest('hex');
const base=()=>({'kantin.request_id':randomUUID()});
const staff=(id)=>({...base(),'kantin.actor_kind':'staff','kantin.actor_id':id});
const customer=(entry,version)=>({...base(),'kantin.actor_kind':'customer','kantin.order_id':entry.order.id,'kantin.grant_id':entry.grantId,...(version?{'kantin.expected_version':version}:{})});
const owner=(callback)=>transact(db,'owner',{...base(),'kantin.actor_kind':'maintenance'},callback);
const getOrder=async(id)=>(await db.query('SELECT * FROM public.orders WHERE id=$1',[id])).rows[0];
async function createCheckout(lines=[{tenant:A,menu:M,qty:1}], options={}) {
  const key=options.key??randomUUID();const hash=options.hash??sha(JSON.stringify(lines));
  return transact(db,'api',{...base(),'kantin.actor_kind':'checkout','kantin.checkout_id':key,'kantin.request_hash':hash},async sql=>{
    await sql.query('INSERT INTO app_private.checkout_requests(idempotency_key,request_hash) VALUES($1,$2) RETURNING idempotency_key',[key,hash]);
    const result=[];
    for(const line of lines){
      const product=(await sql.query('SELECT price FROM public.menus WHERE id=$1',[line.menu])).rows[0];
      const amount=options.total??(product?.price??18000)*line.qty;
      const order=(await sql.query("INSERT INTO public.orders(tenant_id,customer_name,order_type,total) VALUES($1,'Rani Contoh','take_away',$2) RETURNING *",[line.tenant,amount])).rows[0];
      if(!options.skipItems) await sql.query("INSERT INTO public.order_items(order_id,tenant_id,menu_id,menu_name,qty,unit_price,subtotal) VALUES($1,$2,$3,'Spoofed name',$4,1,1) RETURNING *",[order.id,line.tenant,line.menu,line.qty]);
      const token=randomBytes(32).toString('base64url');let grantId;
      if(!options.skipGrant) grantId=(await sql.query('INSERT INTO app_private.order_access_grants(order_id,tenant_id,token_digest) VALUES($1,$2,$3) RETURNING id',[order.id,line.tenant,sha(token)])).rows[0].id;
      result.push({order,grantId,token,key,hash});
    }
    if(!options.skipReplay) await sql.query("UPDATE app_private.checkout_requests SET response_ciphertext=$1 WHERE idempotency_key=$2 RETURNING completed_at",['v1:'+randomBytes(48).toString('base64url'),key]);
    return result;
  });
}
async function transition(entry,id,status,reason){
  const current=await getOrder(entry.order.id);
  return transact(db,'api',{...staff(id),'kantin.expected_version':current.version,...(reason?{'kantin.rejection_reason':reason}:{})},
    sql=>sql.query('UPDATE public.orders SET status=$2 WHERE id=$1 RETURNING *',[entry.order.id,status]));
}
before(async()=>{
  db=await makeDatabase();
  await db.exec(await readSql(baselineUrl));
  await db.exec(await readSql(seedUrl));
  initialCounts=(await db.query('SELECT (SELECT count(*) FROM public.outlets)::int AS outlets,(SELECT count(*) FROM public.tenants)::int AS tenants,(SELECT count(*) FROM public.menus)::int AS menus')).rows[0];
  await owner(async sql=>{
    await sql.query('INSERT INTO auth.users(id,email) VALUES($1,$2),($3,$4),($5,$6)',[admin,'admin@example.com',userA,'a@example.com',userB,'b@example.com']);
    await sql.query("UPDATE public.tenants SET qris_image_url='https://project.supabase.co/storage/v1/object/tenant-qris/a.png',qris_merchant_name='Merchant A',is_active=true WHERE id=$1",[A]);
    await sql.query("INSERT INTO public.tenants(id,outlet_id,name,description,qris_image_url,qris_merchant_name,is_active) VALUES($1,'10000000-0000-4000-8000-000000000001','Tenant B','Test fixture only','https://project.supabase.co/storage/v1/object/tenant-qris/b.png','Merchant B',true)",[B]);
    await sql.query("INSERT INTO public.menus(id,tenant_id,name,price) VALUES($1,$2,'Menu tenant B',25000)",[MB,B]);
    await sql.query("INSERT INTO app_private.users(id,role,tenant_id,email) VALUES($1,'admin_pengelola',NULL,'admin@example.com'),($2,'tenant',$3,'a@example.com'),($4,'tenant',$5,'b@example.com')",[admin,userA,A,userB,B]);
  });
  [a]=await createCheckout();[b]=await createCheckout([{tenant:B,menu:MB,qty:1}]);
});
after(async()=>{if(db)await db.close();});

test('baseline executes, all 12 application tables enforce RLS, and the seed starts with one tenant',async()=>{
  assert.deepEqual(initialCounts,{outlets:1,tenants:1,menus:8});
  const rows=(await db.query("SELECT c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r' AND (n.nspname='app_private' OR (n.nspname='public' AND c.relname IN ('outlets','tenants','menus','orders','order_items')))")).rows;
  assert.equal(rows.length,12);assert.ok(rows.every(row=>row.relrowsecurity&&row.relforcerowsecurity));
  const role=(await db.query("SELECT rolbypassrls,rolsuper,rolcreaterole,rolcreatedb,rolcanlogin FROM pg_roles WHERE rolname='kantin_api'")).rows[0];
  assert.ok(Object.values(role).every(value=>value===false));
  assert.equal((await db.query("SELECT pg_has_role('authenticator','kantin_api','MEMBER') AS member")).rows[0].member,false);
});
test('seed is repeatable without overwriting an existing merchant or active tenant',async()=>{
  await db.exec(await readSql(seedUrl));assert.equal((await db.query('SELECT count(*)::int AS n FROM public.tenants')).rows[0].n,2);
  assert.equal((await db.query('SELECT is_active FROM public.tenants WHERE id=$1',[A])).rows[0].is_active,true);
});
test('API queries without context fail closed and transaction-local scope does not leak',async()=>{
  await transact(db,'api',staff(userA),async sql=>assert.equal((await sql.query('SELECT * FROM public.orders')).rows.length,1));
  await transact(db,'api',{},async sql=>{assert.equal((await sql.query('SELECT * FROM public.orders')).rows.length,0);assert.equal((await sql.query('SELECT * FROM public.menus')).rows.length,0);});
});
test('anon and authenticated cannot write tables, read orders, or execute private capability lookup',async()=>{
  for(const role of ['anon','authenticated']){
    await assert.rejects(()=>transact(db,role,{},sql=>sql.query('SELECT * FROM public.orders')),error=>error.code==='42501');
    await assert.rejects(()=>transact(db,role,{},sql=>sql.query("INSERT INTO public.menus(tenant_id,name,price) VALUES($1,'Bad',1)",[A])),error=>error.code==='42501');
    await assert.rejects(()=>transact(db,role,{},sql=>sql.query('SELECT app_private.resolve_order_grant($1,$2)',[a.order.id,sha(a.token)])),error=>error.code==='42501');
  }
});
test('Storage restrictive policy blocks reserved buckets despite an existing permissive policy',async()=>{
  await db.exec("INSERT INTO storage.buckets(id,name,public) VALUES('unrelated','unrelated',true); INSERT INTO storage.objects(bucket_id,name) VALUES('menu-photos','seed.jpg'),('unrelated','other.jpg')");
  await transact(db,'anon',{},async sql=>{const rows=(await sql.query('SELECT bucket_id FROM storage.objects')).rows;assert.deepEqual(rows,[{bucket_id:'unrelated'}]);});
  for(const role of ['anon','authenticated'])await assert.rejects(()=>transact(db,role,{},sql=>sql.query("INSERT INTO storage.objects(bucket_id,name) VALUES('menu-photos','bad.jpg')")),error=>error.code==='42501');
});
test('checkout snapshots current DB price/name, merchant, and private token digest',async()=>{
  const item=(await db.query('SELECT * FROM public.order_items WHERE order_id=$1',[a.order.id])).rows[0];
  assert.equal(item.unit_price,18000);assert.equal(item.subtotal,18000);assert.equal(item.menu_name,'Nasi Ayam Geprek');
  assert.equal((await db.query('SELECT merchant_name FROM app_private.order_payment_snapshots WHERE order_id=$1',[a.order.id])).rows[0].merchant_name,'Merchant A');
  const raw=await getOrder(a.order.id);
  OrderSchema.parse({...raw,created_at:new Date(raw.created_at).toISOString(),updated_at:new Date(raw.updated_at).toISOString()});
  assert.equal((await db.query('SELECT token_digest FROM app_private.order_access_grants WHERE id=$1',[a.grantId])).rows[0].token_digest,sha(a.token));
  assert.ok(!Object.keys(raw).some(key=>/digest|token|secret/.test(key)));
});
test('one checkout supports separate tenant orders and rolls back entirely on an invalid second tenant item',async()=>{
  const entries=await createCheckout([{tenant:A,menu:M,qty:2},{tenant:B,menu:MB,qty:1}]);
  assert.equal(entries.length,2);assert.notEqual(entries[0].order.tenant_id,entries[1].order.tenant_id);
  const before=(await db.query('SELECT count(*)::int AS n FROM public.orders')).rows[0].n;
  await assert.rejects(()=>createCheckout([{tenant:A,menu:M,qty:1},{tenant:B,menu:M,qty:1}]));
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.orders')).rows[0].n,before);
});
test('customer capability and digest cannot read another order',async()=>{
  await transact(db,'api',customer(a),async sql=>{assert.equal((await sql.query('SELECT * FROM public.orders')).rows.length,1);assert.equal((await sql.query('SELECT * FROM public.orders WHERE id=$1',[b.order.id])).rows.length,0);});
  await transact(db,'api',{...customer(a),'kantin.order_id':b.order.id},async sql=>assert.equal((await sql.query('SELECT * FROM public.orders')).rows.length,0));
  await transact(db,'api',{},async sql=>{assert.equal((await sql.query('SELECT app_private.resolve_order_grant($1,$2) AS id',[a.order.id,sha('wrong')])).rows[0].id,null);assert.equal((await sql.query('SELECT app_private.resolve_order_grant($1,$2) AS id',[a.order.id,sha(a.token)])).rows[0].id,a.grantId);});
});
test('customer can report paid but cannot accept payment or forge a paid status',async()=>{
  const result=await transact(db,'api',customer(a,1),sql=>sql.query("UPDATE public.orders SET status='menunggu_konfirmasi' WHERE id=$1 RETURNING *",[a.order.id]));
  assert.equal(result.rows[0].payment_status,'pending_confirmation');assert.equal(result.rows[0].version,2);
  await assert.rejects(()=>transact(db,'api',customer(a,2),sql=>sql.query("UPDATE public.orders SET status='diproses',payment_status='paid' WHERE id=$1",[a.order.id])),error=>error.code==='42501');
});
test('tenant A/B cannot read or update each other orders; tenant cannot create a tenant',async()=>{
  await transact(db,'api',staff(userB),async sql=>{assert.equal((await sql.query('SELECT * FROM public.orders WHERE id=$1',[a.order.id])).rows.length,0);assert.equal((await sql.query("UPDATE public.orders SET status='diproses' WHERE id=$1 RETURNING id",[a.order.id])).rows.length,0);});
  await assert.rejects(()=>transact(db,'api',staff(userA),sql=>sql.query("INSERT INTO public.tenants(outlet_id,name) VALUES('10000000-0000-4000-8000-000000000001','Unauthorized tenant')")),error=>error.code==='42501');
  await assert.rejects(()=>transact(db,'api',staff(userA),sql=>sql.query("INSERT INTO public.menus(tenant_id,name,price) VALUES($1,'Bad cross scope',1)",[B])),error=>error.code==='42501');
});
test('rejection requires reason and audit; customer may report again after rejection',async()=>{
  await assert.rejects(()=>transition(a,userA,'menunggu_bayar'),error=>error.code==='22023');
  await transition(a,userA,'menunggu_bayar','Mutasi belum masuk');
  const row=await getOrder(a.order.id);assert.equal(row.payment_status,'rejected');
  const event=(await db.query("SELECT reason,actor_user_id FROM app_private.order_events WHERE order_id=$1 AND action='payment_rejected'",[a.order.id])).rows[0];
  assert.equal(event.reason,'Mutasi belum masuk');assert.equal(event.actor_user_id,userA);
  await transact(db,'api',customer(a,row.version),sql=>sql.query("UPDATE public.orders SET status='menunggu_konfirmasi' WHERE id=$1",[a.order.id]));
});
test('acceptance records the actual actor and timestamp even if caller supplies another actor',async()=>{
  const current=await getOrder(a.order.id);
  const result=await transact(db,'api',{...staff(userA),'kantin.expected_version':current.version},sql=>sql.query("UPDATE public.orders SET status='diproses',payment_confirmed_by=$2 WHERE id=$1 RETURNING *",[a.order.id,userB]));
  assert.equal(result.rows[0].payment_status,'paid');assert.equal(result.rows[0].payment_confirmed_by,userA);assert.ok(result.rows[0].payment_confirmed_at);
});
test('paid cancellation and terminal rewrites fail; ready and completed preserve payment audit',async()=>{
  await assert.rejects(()=>transition(a,userA,'dibatalkan'),error=>error.code==='22023');
  await transition(a,userA,'siap');await transition(a,userA,'selesai');
  const row=await getOrder(a.order.id);assert.equal(row.payment_status,'paid');assert.equal(row.payment_confirmed_by,userA);
  await assert.rejects(()=>transition(a,userA,'siap'),error=>error.code==='22023');
});
test('stale expected_version is rejected instead of losing a newer update',async()=>{
  await transact(db,'api',customer(b,1),sql=>sql.query("UPDATE public.orders SET status='menunggu_konfirmasi' WHERE id=$1",[b.order.id]));
  await assert.rejects(()=>transact(db,'api',{...staff(admin),'kantin.expected_version':1},sql=>sql.query("UPDATE public.orders SET status='diproses' WHERE id=$1",[b.order.id])),error=>error.code==='40001');
  assert.equal((await getOrder(b.order.id)).status,'menunggu_konfirmasi');
});
test('disabled profile loses access immediately despite unchanged actor context',async()=>{
  await owner(sql=>sql.query('UPDATE app_private.users SET is_active=false WHERE id=$1',[userA]));
  await transact(db,'api',staff(userA),async sql=>{assert.equal((await sql.query('SELECT * FROM public.orders')).rows.length,0);assert.equal((await sql.query('SELECT * FROM public.menus')).rows.length,0);});
  await owner(sql=>sql.query('UPDATE app_private.users SET is_active=true WHERE id=$1',[userA]));
});
test('tracker with no channel filter still sees only its signed scope; invalid/expired purpose claims deny all',async()=>{
  const epoch=Math.floor(Date.now()/1000);
  const claims={role:'order_tracker',purpose:'order_tracking',order_id:a.order.id,jti:a.grantId,iat:epoch,exp:epoch+240};
  const read=async(value)=>transact(db,'tracker',{'request.jwt.claims':JSON.stringify(value)},sql=>sql.query('SELECT id FROM public.orders'));
  assert.deepEqual((await read(claims)).rows,[{id:a.order.id}]);
  for(const invalid of [{...claims,purpose:'admin'},{...claims,exp:epoch-1},{...claims,jti:b.grantId},{...claims,order_id:'not-a-uuid'},{}, {...claims,exp:epoch+9999}]){
    assert.equal((await read(invalid)).rows.length,0);
  }
  await assert.rejects(()=>transact(db,'tracker',{'request.jwt.claims':JSON.stringify(claims)},sql=>sql.query("UPDATE public.orders SET status='siap' WHERE id=$1",[a.order.id])),error=>error.code==='42501');
});
test('revoking an access grant denies both tracker rows and subsequent HTTP capability lookup',async()=>{
  await transact(db,'api',staff(userA),sql=>sql.query('UPDATE app_private.order_access_grants SET revoked_at=now() WHERE id=$1',[a.grantId]));
  const epoch=Math.floor(Date.now()/1000);
  await transact(db,'tracker',{'request.jwt.claims':JSON.stringify({role:'order_tracker',purpose:'order_tracking',order_id:a.order.id,jti:a.grantId,iat:epoch,exp:epoch+240})},async sql=>assert.equal((await sql.query('SELECT * FROM public.orders')).rows.length,0));
  await transact(db,'api',{},async sql=>assert.equal((await sql.query('SELECT app_private.resolve_order_grant($1,$2) AS id',[a.order.id,sha(a.token)])).rows[0].id,null));
});
test('menu price and tenant QRIS changes cannot rewrite existing financial snapshots',async()=>{
  await transact(db,'api',staff(userA),sql=>sql.query('UPDATE public.menus SET price=21000 WHERE id=$1',[M]));
  await transact(db,'api',staff(admin),sql=>sql.query("UPDATE public.tenants SET qris_merchant_name='Merchant new',qris_image_url='https://project.supabase.co/new.png' WHERE id=$1",[A]));
  assert.equal((await db.query('SELECT unit_price FROM public.order_items WHERE order_id=$1',[a.order.id])).rows[0].unit_price,18000);
  assert.equal((await db.query('SELECT merchant_name FROM app_private.order_payment_snapshots WHERE order_id=$1',[a.order.id])).rows[0].merchant_name,'Merchant A');
  await assert.rejects(()=>owner(sql=>sql.query('UPDATE public.order_items SET subtotal=1 WHERE order_id=$1',[a.order.id])),error=>error.code==='42501');
  await assert.rejects(()=>owner(sql=>sql.query('DELETE FROM app_private.order_events WHERE order_id=$1',[a.order.id])),error=>error.code==='42501');
});
test('forged totals, empty item lists, excessive quantity, missing grant and missing encrypted replay roll back',async()=>{
  const before=(await db.query('SELECT count(*)::int AS n FROM public.orders')).rows[0].n;
  for(const options of [{total:1},{skipItems:true},{skipGrant:true},{skipReplay:true}])await assert.rejects(()=>createCheckout(undefined,options));
  await assert.rejects(()=>createCheckout([{tenant:A,menu:M,qty:100}]));
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.orders')).rows[0].n,before);
});
test('idempotency response is immutable and another payload hash cannot retrieve it',async()=>{
  await transact(db,'api',{...base(),'kantin.actor_kind':'checkout','kantin.checkout_id':b.key,'kantin.request_hash':b.hash},async sql=>assert.equal((await sql.query('SELECT response_ciphertext FROM app_private.checkout_requests')).rows.length,1));
  await transact(db,'api',{...base(),'kantin.actor_kind':'checkout','kantin.checkout_id':b.key,'kantin.request_hash':sha('another body')},async sql=>assert.equal((await sql.query('SELECT * FROM app_private.checkout_requests')).rows.length,0));
  await assert.rejects(()=>owner(sql=>sql.query("UPDATE app_private.checkout_requests SET response_ciphertext='v1:replacement-of-existing-replay' WHERE idempotency_key=$1",[b.key])),error=>error.code==='22023');
});
test('tenant activation without QRIS is rejected and order history cannot be hard deleted',async()=>{
  await assert.rejects(()=>transact(db,'api',staff(admin),sql=>sql.query("INSERT INTO public.tenants(outlet_id,name,is_active) VALUES('10000000-0000-4000-8000-000000000001','Not ready',true)")),error=>error.code==='23514');
  await assert.rejects(()=>owner(sql=>sql.query('DELETE FROM public.orders WHERE id=$1',[b.order.id])),error=>error.code==='42501');
});

test('code-based HTTP lookup requires the correct token digest, not just an order code',async()=>{
  await transact(db,'api',{},async sql=>{
    assert.deepEqual((await sql.query('SELECT * FROM app_private.resolve_order_access($1,$2)',[b.order.order_code,sha(b.token)])).rows,[{order_id:b.order.id,grant_id:b.grantId}]);
    assert.equal((await sql.query('SELECT * FROM app_private.resolve_order_access($1,$2)',[b.order.order_code,sha('wrong')])).rows.length,0);
  });
});
test('the exact one-paste bundle and read-only verification execute; rerunning cannot reset data',async()=>{
  const fresh=await makeDatabase();
  try{
    const bundle=await readSql(new URL('../../../infra/supabase/setup.sql',import.meta.url));
    await fresh.exec(bundle);
    await fresh.exec(await readSql(new URL('../../../infra/supabase/verify.sql',import.meta.url)));
    await assert.rejects(()=>fresh.exec(bundle),error=>/already exists/.test(error.message));
    await fresh.exec('ROLLBACK');
    assert.equal((await fresh.query('SELECT count(*)::int AS n FROM public.tenants')).rows[0].n,1);
  }finally{await fresh.close();}
});
test('operator access script maps existing Auth identities and enables only the limited runtime login',async()=>{
  let sql=await readSql(new URL('../../../infra/supabase/configure-access.example.sql',import.meta.url));
  sql=sql.replace('REPLACE_WITH_RANDOM_API_PASSWORD','local-test-'+randomBytes(24).toString('hex'))
    .replace('REPLACE_ADMIN_EMAIL','admin@example.com').replace('REPLACE_TENANT_EMAIL','a@example.com');
  await db.exec(sql);
  const role=(await db.query("SELECT rolcanlogin,rolbypassrls,rolsuper FROM pg_roles WHERE rolname='kantin_api'")).rows[0];
  assert.deepEqual(role,{rolcanlogin:true,rolbypassrls:false,rolsuper:false});
});
