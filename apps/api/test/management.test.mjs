import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {makeDatabase,readSql,baselineUrl,seedUrl,transact} from './sql-support.mjs';
let db;const admin=randomUUID(),tenantA=randomUUID(),tenantB=randomUUID();
const A='20000000-0000-4000-8000-000000000001',B=randomUUID(),menuA=randomUUID(),menuB=randomUUID();
const ctx=id=>({'kantin.actor_kind':'staff','kantin.actor_id':id,'kantin.request_id':randomUUID()});
const owner=fn=>transact(db,'owner',{'kantin.actor_kind':'maintenance','kantin.request_id':randomUUID()},fn);
before(async()=>{
  db=await makeDatabase();await db.exec(await readSql(baselineUrl));await db.exec(await readSql(seedUrl));
  await db.exec(await readSql(new URL('../prisma/migrations/202611200001_management/migration.sql',import.meta.url)));
  await owner(async sql=>{
    for(const id of [admin,tenantA,tenantB])await sql.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[id,id+'@example.test']);
    const outlet=(await sql.query('SELECT outlet_id FROM public.tenants WHERE id=$1',[A])).rows[0].outlet_id;
    await sql.query("INSERT INTO public.tenants(id,outlet_id,name,description) VALUES($1,$2,'Tenant B','')",[B,outlet]);
    await sql.query("INSERT INTO app_private.users(id,email,role,tenant_id) VALUES($1,'admin@example.test','admin_pengelola',NULL),($2,'a@example.test','tenant',$4),($3,'b@example.test','tenant',$5)",[admin,tenantA,tenantB,A,B]);
    await sql.query("INSERT INTO public.menus(id,tenant_id,name,price,stock,is_available) VALUES($1,$2,'Menu A',10000,5,true),($3,$4,'Menu B',12000,3,true)",[menuA,A,menuB,B]);
  });
});
after(async()=>{await db?.close();});
test('upgrade preserves RLS and history, existing inventory starts empty and unavailable',async()=>{
  const rows=(await db.query("SELECT stock,is_available FROM public.menus WHERE id<>$1 AND id<>$2",[menuA,menuB])).rows;
  assert.ok(rows.every(row=>row.stock===0&&!row.is_available));
  const tables=(await db.query("SELECT c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r' AND n.nspname IN ('public','app_private')")).rows;
  assert.ok(tables.every(row=>row.relrowsecurity&&row.relforcerowsecurity));
});
test('tenant A cannot see or change tenant B stock and cannot create tenants',async()=>{
  await transact(db,'api',ctx(tenantA),async sql=>{
    assert.equal((await sql.query('SELECT stock FROM public.menus WHERE id=$1',[menuB])).rows.length,0);
    assert.equal((await sql.query('UPDATE public.menus SET stock=50 WHERE id=$1 RETURNING id',[menuB])).rows.length,0);
  });
  await assert.rejects(()=>transact(db,'api',ctx(tenantA),sql=>sql.query("INSERT INTO public.tenants(outlet_id,name) SELECT outlet_id,'Foreign' FROM public.tenants WHERE id=$1",[A])),error=>error.code==='42501');
});
test('stock update is versioned; a second stale writer changes nothing; zero forces unavailable',async()=>{
  await transact(db,'api',ctx(tenantA),async sql=>{
    const row=(await sql.query('UPDATE public.menus SET stock=8 WHERE id=$1 AND stock_version=1 RETURNING stock_version',[menuA])).rows[0];assert.equal(row.stock_version,2);
    assert.equal((await sql.query('UPDATE public.menus SET stock=10 WHERE id=$1 AND stock_version=1 RETURNING id',[menuA])).rows.length,0);
    const empty=(await sql.query('UPDATE public.menus SET stock=0,is_available=true WHERE id=$1 RETURNING stock,is_available,stock_version',[menuA])).rows[0];assert.deepEqual(empty,{stock:0,is_available:false,stock_version:3});
  });
  for(const stock of [-1,1000001])await assert.rejects(()=>transact(db,'api',ctx(tenantA),sql=>sql.query('UPDATE public.menus SET stock=$2 WHERE id=$1',[menuA,stock])),error=>error.code==='23514');
});
test('admin archives a draft without QRIS, blocks new menu writes and restores as inactive',async()=>{
  await transact(db,'api',ctx(admin),async sql=>{await sql.query('UPDATE public.tenants SET archived_at=now(),is_active=false WHERE id=$1',[B]);});
  await assert.rejects(()=>transact(db,'api',ctx(tenantB),sql=>sql.query('UPDATE public.menus SET stock=4 WHERE id=$1',[menuB])),error=>error.code==='23514');
  await transact(db,'api',ctx(admin),async sql=>{const row=(await sql.query('UPDATE public.tenants SET archived_at=NULL WHERE id=$1 RETURNING archived_at,is_active',[B])).rows[0];assert.deepEqual(row,{archived_at:null,is_active:false});});
});
test('disabled staff lose RLS access on next transaction and inventory edits leave audit records',async()=>{
  await transact(db,'api',ctx(admin),sql=>sql.query('UPDATE app_private.users SET is_active=false WHERE id=$1',[tenantA]));
  await transact(db,'api',ctx(tenantA),async sql=>{assert.equal((await sql.query('SELECT id FROM public.menus WHERE tenant_id=$1',[A])).rows.length,0);});
  const audits=(await db.query("SELECT after_state->>'stock' AS stock FROM app_private.audit_events WHERE entity_id=$1 AND action='updated'",[menuA])).rows;
  assert.ok(audits.some(row=>row.stock==='0'));
});
