import assert from 'node:assert/strict';
import {after,before,test} from 'node:test';
import {randomUUID} from 'node:crypto';
import type {Server} from 'node:http';
import {createLocalJWKSet,exportJWK,generateKeyPair,SignJWT} from 'jose';
import {type User} from '@kantin/shared';
import {createApp} from '../src/app.js';
import {createVerifier} from '../src/auth.js';
import {HttpError} from '../src/errors.js';
import type {Database,Tx} from '../src/database.js';
import {Media,normalizeImage} from '../src/media.js';
import sharp from 'sharp';
let server:Server,base:string;const adminId=randomUUID(),tenantId=randomUUID();
const actor=(id:string):User=>({id,role:id===adminId?'admin_pengelola':'tenant',tenant_id:id===adminId?null:tenantId,email:'qa@example.test',is_active:true,created_at:new Date().toISOString(),updated_at:new Date().toISOString()});
const calls={invite:0,ban:0,writes:0,upload:0};
const catalogItem={id:randomUUID(),stock:3,isAvailable:true};
const db:Pick<Database,'staff'|'catalog'>={async staff(sub,_request,work){if(sub==='disabled')throw new HttpError(403,'Akun nonaktif.');const tx={$queryRaw:async()=>[],tenant:{findUnique:async()=>({id:tenantId,archivedAt:null})},menu:{updateMany:async()=>{calls.writes++;return {count:0};},findFirst:async()=>({id:tenantId,tenantId,stock:5})}} as unknown as Tx;return work(tx,actor(sub));},async catalog(_request,work){return work({tenant:{findMany:async()=>[]},menu:{findMany:async(args:{select?:{stock?:boolean}})=>args.select?.stock?[catalogItem]:[]}} as unknown as Tx);}};
before(async()=>{
  const app=createApp({db,media:{upload:async()=>{calls.upload++;return 'https://qa.supabase.co/storage/v1/object/public/menu-photos/'+tenantId+'/'+randomUUID()+'.webp';},assertAsset:async()=>{},preview:async()=>null},verify:async token=>{if(token==='admin')return adminId;if(token==='tenant')return tenantId;if(token==='disabled')return 'disabled';throw new HttpError(401,'Sesi invalid.');},accounts:{list:async()=>[],invite:async()=>{calls.invite++;throw new Error('No live calls');},setActive:async()=>{calls.ban++;}},origins:['http://localhost:3001']});
  server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const address=server.address();assert.ok(address&&typeof address!=='string');base='http://127.0.0.1:'+address.port;
});
after(async()=>{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));});
async function call(path:string,token?:string,body?:unknown,method='GET'){return fetch(base+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});}
test('HTTP protected routes reject no token, invalid token and disabled staff',async()=>{
  assert.equal((await call('/api/me')).status,401);assert.equal((await call('/api/me','invalid')).status,401);assert.equal((await call('/api/me','disabled')).status,403);
  const response=await call('/api/me','tenant');assert.equal(response.status,200);const json=await response.json();assert.equal(json.data.role,'tenant');
});
test('tenant cannot list/manage users or create/archive tenants, with no Auth side effects',async()=>{
  assert.equal((await call('/api/admin/users','tenant')).status,403);
  assert.equal((await call('/api/admin/tenants','tenant',{},'POST')).status,403);
  assert.equal((await call('/api/admin/tenants/'+tenantId,'tenant',{archived:true},'PATCH')).status,403);
  assert.equal((await call('/api/admin/tenant-accounts','tenant',{tenant_id:tenantId,email:'qa@example.test'},'POST')).status,403);
  assert.equal(calls.invite,0);assert.equal(calls.ban,0);
});
test('HTTP schemas reject stock fractions, negative values, missing version and spoofed authority',async()=>{
  for(const body of [{stock:-1,expected_version:1},{stock:1.5,expected_version:1},{stock:4},{stock:4,expected_version:1,tenant_id:tenantId}])assert.equal((await call('/api/admin/menus/'+tenantId+'/stock','tenant',body,'PATCH')).status,400);
  assert.equal(calls.writes,0);
  assert.equal((await call('/api/admin/menus/'+tenantId+'/stock','tenant',{stock:4,expected_version:1},'PATCH')).status,409);
});
test('self-deactivation is blocked before DB or Auth mutation; response never includes internal details',async()=>{
  const response=await call('/api/admin/users/'+adminId,'admin',{is_active:false},'PATCH');assert.equal(response.status,409);assert.equal(calls.ban,0);
  const json=await response.json();assert.ok(json.error.request_id);assert.equal('stack' in json.error,false);
});
test('CORS denies unknown origins and accepts allowlisted preflight',async()=>{
  assert.equal((await fetch(base+'/api/me',{headers:{Origin:'https://attacker.example'}})).status,403);
  const response=await fetch(base+'/api/me',{method:'OPTIONS',headers:{Origin:'http://localhost:3001'}});assert.equal(response.status,204);assert.equal(response.headers.get('access-control-allow-origin'),'http://localhost:3001');
});
test('JWT verifier checks signature, expiry, issuer, audience and authenticated role',async()=>{
  const keys=await generateKeyPair('ES256'),jwk=await exportJWK(keys.publicKey);jwk.kid='qa';
  const verify=createVerifier('https://qa.supabase.co',createLocalJWKSet({keys:[jwk]}));
  const sign=(claims:Record<string,unknown>={},issuer='https://qa.supabase.co/auth/v1',audience='authenticated',exp='5m')=>new SignJWT({role:'authenticated',...claims}).setProtectedHeader({alg:'ES256',kid:'qa'}).setSubject(adminId).setIssuer(issuer).setAudience(audience).setExpirationTime(exp).sign(keys.privateKey);
  assert.equal(await verify(await sign()),adminId);
  for(const token of [await sign({role:'order_tracker'}),await sign({},'https://wrong.example'),await sign({},undefined,'wrong'),await sign({},undefined,undefined,'-1s')])await assert.rejects(()=>verify(token),error=>error instanceof HttpError&&error.status===401);
  const valid=await sign();const pieces=valid.split('.');pieces[1]=Buffer.from(JSON.stringify({sub:adminId,role:'authenticated'})).toString('base64url');await assert.rejects(()=>verify(pieces.join('.')));
});
test('public catalog routes work without session and reject malformed queries',async()=>{
  assert.equal((await call('/api/tenants')).status,200);
  assert.deepEqual(await (await call('/api/tenants/'+tenantId+'/menus')).json(),{data:[],next_cursor:null});
  assert.equal((await call('/api/tenants?limit=1000')).status,400);
  assert.equal((await call('/api/tenants/not-a-uuid/menus')).status,400);
});
test('notification feed handles an empty baseline and rejects malformed opaque cursors',async()=>{const response=await call('/api/admin/order-notifications','tenant');assert.equal(response.status,200);const json=await response.json();assert.deepEqual(json.data,[]);assert.equal(json.has_more,false);assert.ok(json.next_cursor);assert.equal((await call('/api/admin/order-notifications?cursor=broken','tenant')).status,400);assert.equal((await call('/api/orders')).status,401);});
test('media validates decoded bytes, MIME agreement, pixel limits and canonical tenant ownership',async()=>{
  const png=await sharp({create:{width:16,height:16,channels:3,background:'white'}}).png().toBuffer();
  const result=await normalizeImage(png,'image/png','tenant_qris');const meta=await sharp(result).metadata();assert.equal(meta.format,'webp');assert.equal(meta.width,16);
  await assert.rejects(()=>normalizeImage(png,'image/jpeg','menu_photo'),error=>error instanceof HttpError&&error.status===415);
  await assert.rejects(()=>normalizeImage(Buffer.from('<svg/>'),'image/png','menu_photo'));
  const huge=await sharp({create:{width:4100,height:4100,channels:3,background:'white'}}).png().toBuffer();await assert.rejects(()=>normalizeImage(huge,'image/png','tenant_qris'));
  const media=new Media('https://qa.supabase.co',undefined),path=tenantId+'/'+randomUUID()+'.webp',url='https://qa.supabase.co/storage/v1/object/public/menu-photos/'+path;
  assert.equal(media.path(url,'menu_photo',tenantId),path);
  for(const bad of [url.replace('qa.supabase.co','foreign.example'),url+'?token=forged',url.replace(tenantId,randomUUID())])assert.throws(()=>media.path(bad,'menu_photo',tenantId));
});
test('upload requires own scope, permits one valid image, and rejects SVG, extra files and size overflow',async()=>{
  const png=await sharp({create:{width:4,height:4,channels:3,background:'white'}}).png().toBuffer();
  async function upload(owner:string,purpose:string,files:Blob[],token='tenant',field='file'){const body=new FormData();for(const file of files)body.append(field,file,'image.png');return fetch(base+'/api/admin/uploads?purpose='+purpose+'&owner_id='+owner,{method:'POST',headers:{Authorization:'Bearer '+token},body});}
  assert.equal((await upload(randomUUID(),'menu_photo',[new Blob([png],{type:'image/png'})])).status,404);
  assert.equal((await upload(tenantId,'tenant_qris',[new Blob([png],{type:'image/png'})])).status,403);
  assert.equal(calls.upload,0);
  assert.equal((await upload(tenantId,'menu_photo',[new Blob([png],{type:'image/png'})])).status,201);
  assert.equal(calls.upload,1);
  assert.equal((await upload(tenantId,'menu_photo',[new Blob(['<svg/>'],{type:'image/png'})])).status,415);
  assert.equal((await upload(tenantId,'menu_photo',[new Blob([png],{type:'image/png'}),new Blob([png],{type:'image/png'})])).status,400);
  assert.equal((await upload(tenantId,'menu_photo',[new Blob([new Uint8Array(2097153)],{type:'image/png'})])).status,413);
  assert.equal((await upload(tenantId,'menu_photo',[new Blob([png],{type:'image/png'})],'tenant','wrong')).status,400);
  assert.equal(calls.upload,1);
});

test('order details project the rejection reason to its owner and the merchant to staff without signing QRIS',async()=>{
  const customer=randomUUID(),other=randomUUID(),id=randomUUID(),menuId=randomUUID(),now=new Date();
  const order={
    id,tenantId,orderCode:'KT-ABCDEFGHIJ',customerName:'Pelanggan uji',orderType:'take_away',
    total:17000,status:'menunggu_bayar',paymentStatus:'rejected',paymentMethod:'qris_static',
    paymentConfirmedAt:null,paymentConfirmedBy:null,version:3,createdAt:now,updatedAt:now,
    items:[{id:randomUUID(),orderId:id,tenantId,menuId,menuName:'Menu uji',qty:1,unitPrice:17000,subtotal:17000}],
  };
  let claims=0;
  const testApp=createApp({
    db:{
      ...db,
      async customer(sub,_request,work){
        return work({
          $queryRaw:async()=>[],
          order:{
            findUnique:async({include}:{include?:object})=>sub===customer
              ? {...order,...(include?{events:[{reason:'Mutasi belum ditemukan'}]}:{})}
              : null,
            update:async()=>{claims++;order.status='menunggu_konfirmasi';order.paymentStatus='pending_confirmation';order.version++;return order;},
          },
        } as unknown as Tx);
      },
      async staff(sub,_request,work){
        return work({
          order:{findFirst:async()=>({...order,paymentSnapshots:[{merchantName:'Merchant uji'}]})},
        } as unknown as Tx,actor(sub));
      },
    },
    verify:async token=>token==='customer'?customer:token==='staff'?tenantId:other,
    accounts:{list:async()=>[],invite:async()=>{throw new Error('Unexpected invite');},setActive:async()=>{}},
    origins:[],
  }).listen(0,'127.0.0.1');
  await new Promise<void>(resolve=>testApp.once('listening',resolve));
  try{
    const address=testApp.address();
    assert.ok(address&&typeof address!=='string');
    const testBase='http://127.0.0.1:'+address.port;
    const path='/api/orders/'+id;
    const request=(path:string,token:string,body?:object)=>fetch(testBase+path,{
      method:body?'PATCH':'GET',
      headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},
      ...(body?{body:JSON.stringify(body)}:{}),
    });
    assert.equal((await request(path,'other')).status,404);
    const owner=await request(path,'customer');
    assert.equal(owner.status,200);
    assert.equal((await owner.json()).payment_rejection_reason,'Mutasi belum ditemukan');
    const staff=await request('/api/admin/orders/'+id,'staff');
    assert.equal(staff.status,200);
    assert.equal((await staff.json()).payment_merchant_name,'Merchant uji');
    for(let retry=0;retry<2;retry++){
      const claim=await request(path+'/paid','customer',{expected_version:3});
      assert.equal(claim.status,200);
      assert.equal((await claim.json()).data.status,'menunggu_konfirmasi');
    }
    assert.equal(claims,1);
  }finally{await new Promise<void>((resolve,reject)=>testApp.close(error=>error?reject(error):resolve()));}
});

test('order chat HTTP supports tenant-to-customer replies, cursor history, and safe retries',async()=>{
  const owner=randomUUID(),foreign=randomUUID(),orderId=randomUUID();
  const now=new Date();
  type MessageRow={id:string;sender:string;senderId:string;text:string;createdAt:Date;sequence:bigint};
  const messages:MessageRow[]=Array.from({length:30},(_,index)=>({
    id:randomUUID(),sender:'tenant',senderId:tenantId,text:'Earlier message '+index,
    createdAt:new Date(now.getTime()-120000+index),sequence:BigInt(index+1),
  }));
  let closed=false;
  function tx(subject:string,perspective:'pelanggan'|'tenant') {
    const permitted=perspective==='pelanggan'?subject===owner:subject===tenantId;
    return {
      $queryRaw:async(query:unknown)=>{
        if(Array.isArray(query)){
          return [{count:messages.filter(row=>row.sender===perspective&&row.createdAt>=now).length}];
        }
        if(!permitted || (query as {values:unknown[]}).values[0]!==orderId)return [];
        return [{status:closed?'selesai':'diproses',actor_id:subject,sender:perspective}];
      },
      orderMessage:{
        findUnique:async({where}:{where:{orderId_id:{id:string;orderId:string}}})=>
          where.orderId_id.orderId===orderId?messages.find(row=>row.id===where.orderId_id.id)??null:null,
        findMany:async({where,take}:{where:{sequence?:{lt:bigint}};take:number})=>messages
          .filter(row=>!where.sequence||row.sequence<where.sequence.lt).reverse().slice(0,take),
        create:async({data}:{data:Omit<MessageRow,'createdAt'|'sequence'>})=>{
          const row={...data,createdAt:new Date(),sequence:BigInt(messages.length+1)};
          messages.push(row);
          return row;
        },
      },
    } as unknown as Tx;
  }
  const testApp=createApp({
    db:{
      ...db,
      async customer(sub,_request,work){return work(tx(sub,'pelanggan'));},
      async staff(sub,_request,work){return work(tx(sub,'tenant'),actor(sub));},
    },
    verify:async token=>token==='owner'?owner:token==='staff'?tenantId:token==='admin'?adminId:foreign,
    accounts:{list:async()=>[],invite:async()=>{throw new Error('Unexpected invite');},setActive:async()=>{}},
    origins:[],
  }).listen(0,'127.0.0.1');
  await new Promise<void>(resolve=>testApp.once('listening',resolve));
  try{
    const address=testApp.address();
    assert.ok(address&&typeof address!=='string');
    const customerPath='/api/orders/'+orderId+'/messages';
    const staffPath='/api/admin/orders/'+orderId+'/messages';
    function chat(path:string,token?:string,body?:object) {
      return fetch('http://127.0.0.1:'+address.port+path,{
        method:body?'POST':'GET',
        headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},
        ...(body?{body:JSON.stringify(body)}:{}),
      });
    }
    assert.equal((await chat(customerPath)).status,401);
    assert.equal((await chat(customerPath,'foreign')).status,404);
    assert.equal((await chat(staffPath,'foreign')).status,404);
    assert.equal((await chat(staffPath,'admin')).status,404);
    assert.equal((await chat(staffPath,'staff',{id:randomUUID(),text:'x',sender:'pelanggan'})).status,400);
    const first={id:randomUUID(),text:'Ambil di kasir ya.'};
    const second={id:randomUUID(),text:'Baik, saya ke kasir.'};
    assert.equal((await chat(staffPath,'staff',first)).status,201);
    assert.equal((await chat(customerPath,'owner',second)).status,201);
    assert.equal((await chat(customerPath,'owner',second)).status,200);
    assert.equal((await chat(staffPath,'staff',second)).status,409);
    assert.equal((await chat(customerPath,'owner',{...second,text:'Diubah'})).status,409);
    assert.equal(messages.length,32);
    const response=await chat(customerPath,'owner');
    assert.equal(response.status,200);
    const page=await response.json();
    assert.deepEqual(page.data.slice(-2).map((message:MessageRow)=>[message.sender,message.text]),
      [['tenant',first.text],['pelanggan',second.text]]);
    assert.ok(!('sender_id' in page.data[0]));
    const older=await (await chat(staffPath+'?cursor='+page.next_cursor,'staff')).json();
    assert.equal(older.data.length,2);
    assert.equal(older.next_cursor,null);
    assert.equal((await chat(customerPath+'?cursor='+randomUUID(),'owner')).status,404);
    for(let count=1;count<12;count++)assert.equal((await chat(customerPath,'owner',{id:randomUUID(),text:'Pesan uji'})).status,201);
    assert.equal((await chat(customerPath,'owner',{id:randomUUID(),text:'Batas'})).status,429);
    closed=true;
    assert.equal((await chat(customerPath,'owner',{id:randomUUID(),text:'Setelah selesai'})).status,409);
    assert.equal((await chat(customerPath,'owner',second)).status,200);
    assert.equal((await (await chat(staffPath,'staff')).json()).closed,true);
  }finally{await new Promise<void>((resolve,reject)=>testApp.close(error=>error?reject(error):resolve()));}
});
test('public stock refresh returns live quantities without exposing management or menu metadata',async()=>{
  const path='/api/catalog/stock?limit=100';
  assert.equal((await call('/api/catalog/stock?limit=101')).status,400);
  try {
    const before=await call(path);
    assert.equal(before.status,200);
    assert.equal(before.headers.get('cache-control'),'no-store');
    assert.deepEqual(await before.json(),{data:[{id:catalogItem.id,stock:3,is_available:true}],next_cursor:null});
    catalogItem.stock=0;
    const soldOut=await call(path);
    assert.deepEqual(await soldOut.json(),{data:[{id:catalogItem.id,stock:0,is_available:false}],next_cursor:null});
  }finally{catalogItem.stock=3;}
});
