import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ManagedMenuCreateSchema, ManagedMenuPatchSchema, StockUpdateSchema, ManagedTenantPatchSchema, UserStatusSchema } from '../src/index.js';
test('inventory accepts bounded whole portions and rejects authority, fractional, coercible or stale-shaped input',()=>{
  assert.equal(StockUpdateSchema.parse({stock:0,expected_version:1}).stock,0);
  for(const stock of [-1,1.5,'10',1_000_001,Infinity])assert.equal(StockUpdateSchema.safeParse({stock,expected_version:1}).success,false);
  assert.equal(StockUpdateSchema.safeParse({stock:1,expected_version:0}).success,false);
  assert.equal(StockUpdateSchema.safeParse({stock:1,expected_version:1,tenant_id:crypto.randomUUID()}).success,false);
});
test('managed menu metadata is explicit; patch cannot transfer tenant or write stock without version',()=>{
  const input={name:'Nasi ayam',price:18000,photo_url:null,tenant_id:crypto.randomUUID(),is_available:true,category:'Makanan',description:'Ayam dan nasi',stock:20};
  assert.equal(ManagedMenuCreateSchema.parse(input).stock,20);
  assert.equal(ManagedMenuPatchSchema.safeParse({category:'Minuman'}).success,true);
  assert.equal(ManagedMenuPatchSchema.safeParse({}).success,false);
  assert.equal(ManagedMenuPatchSchema.safeParse({stock:20}).success,false);
  assert.equal(ManagedMenuPatchSchema.safeParse({tenant_id:crypto.randomUUID()}).success,false);
});
test('archive and user status accept only explicit boolean changes',()=>{
  assert.deepEqual(ManagedTenantPatchSchema.parse({archived:true}),{archived:true});
  assert.equal(ManagedTenantPatchSchema.safeParse({}).success,false);
  assert.equal(UserStatusSchema.safeParse({is_active:false,role:'admin_pengelola'}).success,false);
  assert.equal(UserStatusSchema.safeParse({is_active:'false'}).success,false);
});
