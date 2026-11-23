import assert from 'node:assert/strict';
import {test} from 'node:test';
import {VENDOR_CATALOG,VendorImportRequestSchema,OrderNoticeLedger,ExistingTenantAccountSchema} from '../src/index.js';
test('vendor catalog preserves all requested tenants, menu names and exact integer prices',()=>{
 assert.deepEqual(VENDOR_CATALOG.map(tenant=>tenant.name),['Tens','Mie Ayam','Bento']);assert.deepEqual(VENDOR_CATALOG.flatMap(tenant=>tenant.menus.map(menu=>menu.price)),[12000,23000,18000,12000,5000,10000,23000,25000,28000]);assert.equal(VENDOR_CATALOG.reduce((sum,tenant)=>sum+tenant.menus.length,0),9);
 assert.equal(VendorImportRequestSchema.safeParse({catalog_id:'vendor-2026-11-21',outlet_id:crypto.randomUUID(),is_active:true}).success,false);
 assert.equal(ExistingTenantAccountSchema.safeParse({user_id:crypto.randomUUID(),tenant_id:crypto.randomUUID(),role:'admin_pengelola'}).success,false);
});
test('order notifications ignore baseline, stale and duplicate signals and ring once per new event',()=>{
 const ledger=new OrderNoticeLedger(),id=crypto.randomUUID(),tenant_id=crypto.randomUUID();ledger.baseline([{id,tenant_id,status:'menunggu_bayar',version:1}]);assert.equal(ledger.consume({id,tenant_id,status:'menunggu_bayar',version:1}),null);
 assert.equal(ledger.consume({id,tenant_id,status:'menunggu_konfirmasi',version:2}),'payment');assert.equal(ledger.consume({id,tenant_id,status:'menunggu_konfirmasi',version:2}),null);assert.equal(ledger.consume({id,tenant_id,status:'diproses',version:3}),null);assert.equal(ledger.consume({id,tenant_id,status:'menunggu_konfirmasi',version:2}),null);assert.equal(ledger.consume({id:crypto.randomUUID(),tenant_id,status:'menunggu_bayar',version:1}),'order');
});
