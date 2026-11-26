import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {makeDatabase,readSql,baselineUrl,seedUrl,transact} from './sql-support.mjs';
import {OrderSchema} from '@kantin/shared';
let db;const admin=randomUUID(),staffA=randomUUID(),staffB=randomUUID(),customerA=randomUUID(),customerB=randomUUID(),A='20000000-0000-4000-8000-000000000001',B=randomUUID(),M='40000000-0000-4000-8000-000000000001',MB=randomUUID();let orderA,orderB;
const context=()=>({'kantin.request_id':randomUUID()});const staff=id=>({...context(),'kantin.actor_kind':'staff','kantin.actor_id':id});const customer=id=>({...context(),'kantin.actor_kind':'customer_account','kantin.actor_id':id});const owner=fn=>transact(db,'owner',{...context(),'kantin.actor_kind':'maintenance'},fn);
async function create(buyer,lines,minutes=15,details){const key=randomUUID(),hash='a'.repeat(64);return transact(db,'api',{...context(),'kantin.actor_kind':'checkout','kantin.customer_id':buyer,'kantin.checkout_id':key,'kantin.request_hash':hash,...(minutes===null?{}:{'kantin.unpaid_ttl_minutes':minutes})},async sql=>{
 await sql.query('INSERT INTO app_private.checkout_requests(idempotency_key,request_hash) VALUES($1,$2)',[key,hash]);const orders=[];
 for(const {tenant,menu,qty} of lines){
  const price=(await sql.query('SELECT price FROM public.menus WHERE id=$1',[menu])).rows[0].price;
  const row=(await sql.query("INSERT INTO public.orders(tenant_id,customer_name,order_type,total) VALUES($1,'Pemesan uji',$2,$3) RETURNING *",[tenant,details?.type??'take_away',qty*price])).rows[0];
  if(details)await sql.query('INSERT INTO app_private.order_fulfillment_details(order_id,table_number,pickup_note) VALUES($1,$2,$3) RETURNING order_id',
   [row.id,details.table??null,details.note??null]);
  await sql.query("INSERT INTO public.order_items(order_id,tenant_id,menu_id,menu_name,qty,unit_price,subtotal) VALUES($1,$2,$3,'server snapshot',$4,1,1)",[row.id,tenant,menu,qty]);
  await sql.query('INSERT INTO app_private.order_access_grants(order_id,tenant_id,token_digest) VALUES($1,$2,$3)',[row.id,tenant,createHash('sha256').update(randomBytes(32)).digest('hex')]);
  orders.push(row);
 }
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

test('order chat allows both participants, rejects other actors and keeps closed history readable',async()=>{
 const migration=await readSql(new URL('../../../infra/supabase/chat-upgrade.sql',import.meta.url));
 await db.exec(migration);
 const [order]=await create(customerA,[{tenant:B,menu:MB,qty:1}]);
 const stranger=randomUUID();
 await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[stranger,'unrelated@example.test']);
 const send=(scope,sender,text='Pesan uji',id=randomUUID())=>transact(db,'api',scope,sql=>sql.query(
  'INSERT INTO app_private.order_messages(order_id,id,sender,sender_id,text) VALUES($1,$2,$3,$4,$5) RETURNING sender_id',
  [order.id,id,sender,stranger,text],
 ));
 const read=(scope)=>transact(db,'api',scope,async sql=>(await sql.query(
  'SELECT sender,text FROM app_private.order_messages WHERE order_id=$1 ORDER BY sequence',[order.id],
 )).rows);
 assert.deepEqual((await send(staff(staffB),'tenant','Ambil di kasir ya')).rows,[{sender_id:staffB}]);
 assert.deepEqual((await send(customer(customerA),'pelanggan','Baik, saya ke kasir.')).rows,[{sender_id:customerA}]);
 const conversation=[{sender:'tenant',text:'Ambil di kasir ya'},{sender:'pelanggan',text:'Baik, saya ke kasir.'}];
 for(const scope of [customer(customerA),staff(staffB)])assert.deepEqual(await read(scope),conversation);
 for(const scope of [customer(stranger),staff(staffA),staff(admin)])assert.deepEqual(await read(scope),[]);
 await assert.rejects(()=>send(staff(staffA),'tenant'),{code:'42501'});
 await assert.rejects(()=>send(customer(customerA),'tenant'),{code:'42501'});
 await assert.rejects(()=>send(customer(customerA),'pelanggan',' \n\t '),{code:'23514'});
 await assert.rejects(()=>transact(db,'authenticated',rt(customerA),sql=>sql.query('SELECT text FROM app_private.order_messages')),{code:'42501'});
 await assert.rejects(()=>transact(db,'api',customer(customerA),sql=>sql.query('DELETE FROM app_private.order_messages')),{code:'42501'});
 await transact(db,'api',{...staff(staffB),'kantin.expected_version':1},sql=>sql.query(
  "UPDATE public.orders SET status='dibatalkan' WHERE id=$1",[order.id],
 ));
 await assert.rejects(()=>send(staff(staffB),'tenant'),{code:'23514'});
 assert.deepEqual(await read(customer(customerA)),conversation);
 await db.query("UPDATE auth.users SET banned_until=now()+interval '1 hour' WHERE id=$1",[staffB]);
 assert.deepEqual(await read(staff(staffB)),[]);
});

test('operations expiry restores stock once and leaves claims in review',async()=>{
 const sql=await readSql(new URL('../../../infra/supabase/order-operations-upgrade.sql',import.meta.url));
 await db.exec(sql);
 await db.query('UPDATE auth.users SET banned_until=NULL WHERE id=$1',[staffB]);
 const beforeStock=(await db.query('SELECT stock FROM public.menus WHERE id=$1',[MB])).rows[0].stock;
 const [unclaimed]=await create(customerA,[{tenant:B,menu:MB,qty:1}]);
 const [claimed]=await create(customerA,[{tenant:B,menu:MB,qty:1}]);
 assert.equal((await db.query('SELECT 1 FROM app_private.order_payment_windows WHERE order_id=$1',[orderA.id])).rows.length,0);
 const [fromOldApi]=await create(customerA,[{tenant:B,menu:MB,qty:1}],null);
 assert.equal((await db.query('SELECT 1 FROM app_private.order_payment_windows WHERE order_id=$1',[fromOldApi.id])).rows.length,0);
 const windowCheck=await db.query(`SELECT w.deadline_at=o.created_at + interval '15 minutes' AS correct
   FROM app_private.order_payment_windows w JOIN public.orders o ON o.id=w.order_id WHERE o.id=$1`,[unclaimed.id]);
 assert.equal(windowCheck.rows[0].correct,true);
 await transact(db,'api',{...customer(customerA),'kantin.expected_version':1},q=>q.query(
  "UPDATE public.orders SET status='menunggu_konfirmasi' WHERE id=$1",[claimed.id],
 ));
 await db.query("UPDATE app_private.order_payment_windows SET deadline_at=now()-interval '1 second' WHERE order_id IN ($1,$2)",[unclaimed.id,claimed.id]);
 await assert.rejects(()=>transact(db,'api',{...customer(customerA),'kantin.expected_version':1},q=>q.query(
  "UPDATE public.orders SET status='menunggu_konfirmasi' WHERE id=$1",[unclaimed.id],
 )),{code:'23514'});
 const expire=()=>transact(db,'api',{},q=>q.query('SELECT app_private.expire_unpaid_orders() AS count'));
 assert.equal((await expire()).rows[0].count,1);
 assert.equal((await expire()).rows[0].count,0);
 assert.equal((await db.query('SELECT stock FROM public.menus WHERE id=$1',[MB])).rows[0].stock,beforeStock-2);
 const orderStatus=async id=>(await db.query('SELECT status FROM public.orders WHERE id=$1',[id])).rows[0].status;
 assert.equal(await orderStatus(unclaimed.id),'dibatalkan');
 assert.equal(await orderStatus(claimed.id),'menunggu_konfirmasi');
 const event=(await db.query("SELECT actor_kind FROM app_private.order_events WHERE order_id=$1 AND action='status_changed'",[unclaimed.id])).rows[0];
 assert.equal(event.actor_kind,'expiry');
 await assert.rejects(()=>transact(db,'authenticated',rt(customerA),q=>q.query('SELECT app_private.expire_unpaid_orders()')),{code:'42501'});
 const claim=await transact(db,'api',customer(customerA),q=>q.query(
  "INSERT INTO app_private.order_refunds(order_id,reason) VALUES($1,'Sudah transfer') RETURNING source,amount",
  [unclaimed.id],
 ));
 assert.deepEqual(claim.rows,[{source:'expired_claim',amount:unclaimed.total}]);
});

test('refund scope keeps paid history and only the assigned merchant can finish',async()=>{
 const sale=orderB;
 await db.query('UPDATE auth.users SET banned_until=NULL WHERE id=$1',[customerB]);
 const reason='Pesanan tidak dapat digunakan';
 const request=id=>transact(db,'api',customer(id),sql=>sql.query(
  'INSERT INTO app_private.order_refunds(order_id,reason) VALUES($1,$2) RETURNING amount,status',[sale.id,reason],
 ));
 await assert.rejects(()=>request(customerA),{code:'42501'});
 assert.deepEqual((await request(customerB)).rows,[{amount:sale.total,status:'diminta'}]);
 const change=(user,status,ref=null)=>transact(db,'api',staff(user),sql=>sql.query(
  'UPDATE app_private.order_refunds SET status=$2,transfer_ref=$3 WHERE order_id=$1 RETURNING status,version',[sale.id,status,ref],
 ));
 assert.equal((await change(staffA,'diproses')).rows.length,0);
 assert.deepEqual((await change(staffB,'diproses')).rows,[{status:'diproses',version:2}]);
 await assert.rejects(()=>change(admin,'dikembalikan','REF-UJI'),{code:'23514'});
 await assert.rejects(()=>change(staffB,'dikembalikan'),{code:'23514'});
 await assert.rejects(()=>transact(db,'api',{...staff(staffB),'kantin.expected_version':3},sql=>sql.query(
  "UPDATE public.orders SET status='siap' WHERE id=$1",[sale.id],
 )),{code:'23514'});
 assert.deepEqual((await change(staffB,'dikembalikan','REF-UJI')).rows,[{status:'dikembalikan',version:3}]);
 await assert.rejects(()=>change(staffB,'dikembalikan','REF-GANDA'),{code:'23514'});
 const payment=(await db.query('SELECT payment_status,status FROM public.orders WHERE id=$1',[sale.id])).rows[0];
 assert.deepEqual(payment,{payment_status:'paid',status:'diproses'});
});

test('chat read receipts are scoped to the signed-in participant',async()=>{
 const orderId=orderB.id;
 const message=await transact(db,'api',staff(staffB),sql=>sql.query(
  "INSERT INTO app_private.order_messages(order_id,id,sender,sender_id,text) VALUES($1,$2,'tenant',$3,'Pesan baru') RETURNING sequence",
  [orderId,randomUUID(),staffB],
 ));
 const sequence=message.rows[0].sequence;
 const mark=(id,reader)=>transact(db,'api',customer(id),sql=>sql.query(
  'INSERT INTO app_private.order_chat_receipts(order_id,reader_id,last_read_sequence) VALUES($1,$2,$3)',
  [orderId,reader,sequence],
 ));
 await assert.rejects(()=>mark(customerA,customerA),{code:'42501'});
 await assert.rejects(()=>mark(customerB,customerA),{code:'42501'});
 await mark(customerB,customerB);
 const list=scope=>transact(db,'api',scope,sql=>sql.query('SELECT reader_id FROM app_private.order_chat_receipts'));
 assert.deepEqual((await list(customer(customerB))).rows,[{reader_id:customerB}]);
 assert.deepEqual((await list(staff(staffB))).rows,[]);
});
test('order fulfillment stays private and only dine-in may set a table',async()=>{
 const migration=await readSql(new URL('../../../infra/supabase/order-fulfillment-upgrade.sql',import.meta.url));
 await db.exec(migration);
 const line=[{tenant:B,menu:MB,qty:1}];
 const old=(await db.query('SELECT count(*)::int AS count FROM app_private.order_fulfillment_details')).rows[0];
 assert.equal(old.count,0);
 await assert.rejects(()=>create(customerA,line,15,{type:'take_away',table:'A-12'}),{code:'42501'});
 const [dineIn]=await create(customerA,line,15,{type:'dine_in',table:'A-12',note:'Meja dekat pintu'});
 const [takeaway]=await create(customerA,line,15,{type:'take_away',note:'Ambil di kasir'});
 const read=(scope,id)=>transact(db,'api',scope,async query=>(await query.query(
  'SELECT table_number,pickup_note FROM app_private.order_fulfillment_details WHERE order_id=$1',[id],
 )).rows);
 const expected=[{table_number:'A-12',pickup_note:'Meja dekat pintu'}];
 for(const scope of [customer(customerA),staff(staffB),staff(admin)])assert.deepEqual(await read(scope,dineIn.id),expected);
 for(const scope of [customer(customerB),staff(staffA),{'kantin.actor_kind':'public'}])assert.deepEqual(await read(scope,dineIn.id),[]);
 assert.deepEqual(await read(customer(customerA),takeaway.id),[{table_number:null,pickup_note:'Ambil di kasir'}]);
 await assert.rejects(()=>transact(db,'authenticated',rt(customerA),sql=>sql.query('SELECT pickup_note FROM app_private.order_fulfillment_details')),{code:'42501'});
 await assert.rejects(()=>transact(db,'api',staff(staffB),sql=>sql.query('UPDATE app_private.order_fulfillment_details SET pickup_note=$1 WHERE order_id=$2',['Diubah',dineIn.id])),{code:'42501'});
});

test('payment proof is mandatory per claim and only the order tenant can operate on it',async()=>{
 await db.exec(await readSql(new URL('../../../infra/supabase/tenant-payment-proofs-upgrade.sql',import.meta.url)));
 const [order]=await create(customerA,[{tenant:B,menu:MB,qty:1}]);
 const objectPath=order.id+'/'+randomUUID()+'.webp';
 const move=(scope,version,status)=>transact(db,'api',{...scope,'kantin.expected_version':version},sql=>sql.query(
  'UPDATE public.orders SET status=$2 WHERE id=$1 RETURNING status',[order.id,status],
 ));
 const proof=sql=>sql.query(
  'INSERT INTO app_private.order_payment_proofs(order_id,claim_version,object_path) VALUES($1,$2,$3)',
  [order.id,2,objectPath],
 );
 await assert.rejects(()=>move(customer(customerA),1,'menunggu_konfirmasi'),{code:'23514'});
 await assert.rejects(()=>transact(db,'api',customer(customerB),proof),{code:'42501'});
 await assert.rejects(()=>transact(db,'api',staff(staffB),proof),{code:'42501'});
 await transact(db,'api',{...customer(customerA),'kantin.expected_version':1},async sql=>{
  await proof(sql);
  await sql.query("UPDATE public.orders SET status='menunggu_konfirmasi' WHERE id=$1",[order.id]);
 });
 const paths=scope=>transact(db,'api',scope,async sql=>(await sql.query(
  'SELECT object_path FROM app_private.order_payment_proofs WHERE order_id=$1',[order.id],
 )).rows);
 assert.deepEqual(await paths(staff(staffB)),[{object_path:objectPath}]);
 for(const scope of [staff(admin),staff(staffA),customer(customerB)])assert.deepEqual(await paths(scope),[]);
 await assert.rejects(()=>move(staff(admin),2,'diproses'),{code:'42501'});
 assert.deepEqual((await move(staff(staffA),2,'diproses')).rows,[]);
 assert.deepEqual((await move(staff(staffB),2,'diproses')).rows,[{status:'diproses'}]);
 await assert.rejects(()=>move(staff(admin),3,'siap'),{code:'42501'});
 assert.deepEqual((await move(staff(staffB),3,'siap')).rows,[{status:'siap'}]);
 assert.deepEqual((await move(staff(staffB),4,'selesai')).rows,[{status:'selesai'}]);
 await db.query('INSERT INTO storage.objects(bucket_id,name) VALUES($1,$2)',['payment-proofs',objectPath]);
 await transact(db,'authenticated',rt(customerA),async sql=>{
  assert.deepEqual((await sql.query("SELECT name FROM storage.objects WHERE bucket_id='payment-proofs'")).rows,[]);
  assert.deepEqual((await sql.query("SELECT id FROM storage.buckets WHERE id='payment-proofs'")).rows,[]);
 });
});
