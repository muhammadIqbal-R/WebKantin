import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID,randomBytes} from 'node:crypto';
import {checkout} from '../src/order-service.ts';
import {ReplayCipher} from '../src/replay.ts';
function fixture(){
 const buyer=randomUUID(),tenantId=randomUUID(),menuId=randomUUID(),cipher=new ReplayCipher(randomBytes(32).toString('base64'));let state={requests:new Map(),orders:[],items:[],grants:[],stock:5};
 const db={async checkout(sub,key,hash,_request,work){const old=structuredClone(state);const tx={
  checkoutRequest:{findUnique:async()=>{const row=state.requests.get(key);return row?.customerId===sub&&row.requestHash===hash?row:null;},create:async({data})=>{if(state.requests.has(key)){const error=new Error('Unique');error.code='P2002';throw error;}state.requests.set(key,{...data,expiresAt:new Date(Date.now()+86400000),responseCiphertext:null});},update:async({data})=>{Object.assign(state.requests.get(key),data);}},
  menu:{findMany:async()=>[{id:menuId,tenantId,name:'Americano',price:12000,stock:state.stock,tenant:{qrisImageUrl:'https://qa.supabase.co/qris.webp',qrisMerchantName:'Tens'}}]},
  order:{create:async({data})=>{const row={...data,id:randomUUID(),orderCode:'KT-TEST000001',status:'menunggu_bayar',paymentStatus:'unpaid',paymentMethod:'qris_static',paymentConfirmedBy:null,paymentConfirmedAt:null,version:1,createdAt:new Date(),updatedAt:new Date()};state.orders.push(row);return row;}},
  orderItem:{create:async({data})=>{if(state.stock<data.qty){const error=new Error('Stock');error.code='23514';throw error;}state.stock-=data.qty;state.items.push(data);}},orderAccessGrant:{create:async({data})=>state.grants.push(data)},orderPaymentSnapshot:{findUniqueOrThrow:async()=>({qrisImageUrl:'https://qa.supabase.co/qris.webp',merchantName:'Tens'})},
 };try{return await work(tx);}catch(error){state=old;throw error;}}};
 return {db,cipher,buyer,menuId,input:{customer_name:'Pemesan uji',order_type:'take_away',items:[{menu_id:menuId,qty:2}]},state:()=>state};
}
test('checkout service replay preserves exact order/token response and reserves once (transaction double)',async()=>{const f=fixture(),key=randomUUID();const first=await checkout(f.db,f.cipher,f.buyer,key,f.input,randomUUID()),again=await checkout(f.db,f.cipher,f.buyer,key,f.input,randomUUID());assert.deepEqual(again,first);assert.equal(first.orders[0].order.total,24000);assert.equal(f.state().stock,3);assert.equal(f.state().orders.length,1);assert.equal(f.state().grants.length,1);assert.equal(f.state().grants[0].tokenDigest.length,64);assert.notEqual(f.state().grants[0].tokenDigest,first.orders[0].order_access_token);});
test('same idempotency key cannot replay another owner or changed payload',async()=>{const f=fixture(),key=randomUUID();await checkout(f.db,f.cipher,f.buyer,key,f.input,randomUUID());await assert.rejects(()=>checkout(f.db,f.cipher,randomUUID(),key,f.input,randomUUID()));await assert.rejects(()=>checkout(f.db,f.cipher,f.buyer,key,{...f.input,customer_name:'Nama berbeda'},randomUUID()));assert.equal(f.state().orders.length,1);});
test('stock failure leaves no checkout or partial order in transaction double',async()=>{const f=fixture();await assert.rejects(()=>checkout(f.db,f.cipher,f.buyer,randomUUID(),{...f.input,items:[{menu_id:f.menuId,qty:6}]},randomUUID()));assert.equal(f.state().orders.length,0);assert.equal(f.state().requests.size,0);assert.equal(f.state().stock,5);});
