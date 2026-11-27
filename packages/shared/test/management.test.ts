import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  collectMenuCategories, ManagedMenuCreateSchema, ManagedMenuPatchSchema, MenuPriceInputSchema,
  StockUpdateSchema, ManagedTenantPatchSchema, UserStatusSchema,
} from '../src/index.js';
test('inventory accepts bounded whole portions and rejects authority, fractional, coercible or stale-shaped input',()=>{
  assert.equal(StockUpdateSchema.parse({stock:0,expected_version:1}).stock,0);
  for(const stock of [-1,1.5,'10',1_000_001,Infinity])assert.equal(StockUpdateSchema.safeParse({stock,expected_version:1}).success,false);
  assert.equal(StockUpdateSchema.safeParse({stock:1,expected_version:0}).success,false);
  assert.equal(StockUpdateSchema.safeParse({stock:1,expected_version:1,tenant_id:crypto.randomUUID()}).success,false);
});
test('managed menu metadata is explicit; patch cannot transfer tenant or write stock without version',()=>{
  const input={name:'Nasi ayam',price:18000,photo_url:null,tenant_id:crypto.randomUUID(),is_available:true,category:'Makanan',description:'Ayam dan nasi',stock:20};
  assert.equal(ManagedMenuCreateSchema.parse(input).stock,20);
  assert.deepEqual(ManagedMenuPatchSchema.parse({category:'  Ayam & Bebek  '}),{category:'Ayam & Bebek'});
  assert.equal(ManagedMenuCreateSchema.parse({...input,category:'Dessert'}).category,'Dessert');
  for (const category of ['', '  ', 'x'.repeat(41), 'Ayam\nBebek']) {
    assert.equal(ManagedMenuPatchSchema.safeParse({category}).success,false);
  }
  assert.equal(ManagedMenuCreateSchema.safeParse({...input,price:'18.000'}).success,false);
  assert.equal(ManagedMenuPatchSchema.safeParse({}).success,false);
  assert.equal(ManagedMenuPatchSchema.safeParse({stock:20}).success,false);
  assert.equal(ManagedMenuPatchSchema.safeParse({tenant_id:crypto.randomUUID()}).success,false);
});
test('menu price input preserves rupiah with or without grouping dots', () => {
  for (const input of ['20000', '20.000', ' 20.000 ']) {
    assert.equal(MenuPriceInputSchema.parse(input), 20000);
  }
  assert.equal(MenuPriceInputSchema.parse('1.000.000.000'), 1_000_000_000);
  for (const input of ['', '0', '-20.000', '20.00', '20,000', '2e4', '1.000.000.001']) {
    assert.equal(MenuPriceInputSchema.safeParse(input).success, false);
  }
});
test('menu category filters reuse one label for different capitalization', () => {
  assert.deepEqual([...collectMenuCategories(['Ayam', 'ayam', 'Dessert'])], [
    ['ayam', 'Ayam'], ['dessert', 'Dessert'],
  ]);
});
test('archive and user status accept only explicit boolean changes',()=>{
  assert.deepEqual(ManagedTenantPatchSchema.parse({archived:true}),{archived:true});
  assert.equal(ManagedTenantPatchSchema.safeParse({}).success,false);
  assert.equal(UserStatusSchema.safeParse({is_active:false,role:'admin_pengelola'}).success,false);
  assert.equal(UserStatusSchema.safeParse({is_active:'false'}).success,false);
});
