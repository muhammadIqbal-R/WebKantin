import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {createApp} from '../src/app.ts';
import {Media} from '../src/media.ts';
import {HttpError} from '../src/errors.ts';

test('onboarding HTTP: draft tenant, scoped menu/photo/stock, QRIS, activation and public catalog (DB/Storage doubles)',async()=>{
  const admin=randomUUID(),outlet=randomUUID(),tenants=new Map(),menus=new Map(),assets=new Set();
  const pathGuard=new Media('https://qa.supabase.co',undefined);
  const timestamp=()=>new Date();
  const match=(row,where={})=>(where.id===undefined||typeof where.id==='object'||row.id===where.id)&&(where.tenantId===undefined||row.tenantId===where.tenantId)&&(where.isActive===undefined||row.isActive===where.isActive);
  const tx={
    $queryRaw:async()=>[{id:outlet}],
    tenant:{
      create:async({data})=>{const row={id:randomUUID(),qrisImageUrl:null,qrisMerchantName:null,archivedAt:null,createdAt:timestamp(),updatedAt:timestamp(),...data};tenants.set(row.id,row);return row;},
      findUnique:async({where})=>tenants.get(where.id)??null,
      findMany:async({where,take})=>[...tenants.values()].filter(row=>match(row,where)).slice(0,take),
      update:async({where,data})=>{const row={...tenants.get(where.id),...data,updatedAt:timestamp()};tenants.set(row.id,row);return row;},
    },
    menu:{
      create:async({data})=>{const row={id:randomUUID(),isActive:true,stockVersion:1,createdAt:timestamp(),updatedAt:timestamp(),...data};menus.set(row.id,row);return row;},
      count:async({where})=>[...menus.values()].filter(row=>match(row,where)&&row.stock>0&&row.isAvailable).length,
      findMany:async({where,take})=>[...menus.values()].filter(row=>match(row,where)&&(!where.tenant||tenants.get(row.tenantId)?.isActive)).slice(0,take),
    },
  };
  const app=createApp({db:{staff:async(_sub,_request,work)=>work(tx,{id:admin,role:'admin_pengelola',tenant_id:null,email:'qa@example.test',is_active:true,created_at:timestamp().toISOString(),updated_at:timestamp().toISOString()}),catalog:async(_request,work)=>work(tx)},verify:async token=>{if(token!=='test-admin')throw new HttpError(401,'Invalid');return admin;},accounts:{list:async()=>[],invite:async()=>{throw new Error('No email in this test');},setActive:async()=>{}},media:{upload:async(_bytes,purpose,owner)=>{const url='https://qa.supabase.co/storage/v1/object/'+(purpose==='menu_photo'?'public/menu-photos/':'authenticated/tenant-qris/')+owner+'/'+randomUUID()+'.webp';assets.add(url);return url;},assertAsset:async(url,purpose,owner)=>{pathGuard.path(url,purpose,owner);if(!assets.has(url))throw new HttpError(400,'Missing asset');},preview:async()=>null},origins:[]});
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  try{
    const base='http://127.0.0.1:'+server.address().port;
    async function call(path,method='GET',body,publicRequest=false){return fetch(base+path,{method,headers:{...(!publicRequest?{Authorization:'Bearer test-admin'}:{}),...(body===undefined||body instanceof FormData?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:body instanceof FormData?body:JSON.stringify(body)})});}
    const created=await call('/api/admin/tenants','POST',{outlet_id:outlet,name:'Kedai Baru',description:'Masakan rumahan',qris_image_url:null,qris_merchant_name:null});assert.equal(created.status,201);const tenant=(await created.json()).data;
    assert.equal((await (await call('/api/tenants','GET',undefined,true)).json()).data.length,0);
    assert.equal((await call('/api/admin/tenants/'+tenant.id,'PATCH',{is_active:true})).status,409);
    const png=await sharp({create:{width:32,height:32,channels:3,background:'white'}}).png().toBuffer();
    async function upload(purpose){const body=new FormData();body.append('file',new Blob([png],{type:'image/png'}),'test.png');const response=await call('/api/admin/uploads?purpose='+purpose+'&owner_id='+tenant.id,'POST',body);assert.equal(response.status,201);return (await response.json()).asset_url;}
    const photo=await upload('menu_photo');
    const input={tenant_id:tenant.id,name:'Nasi Ayam',price:18000,category:'Makanan',description:'Nasi dan ayam',stock:12,is_available:true,photo_url:photo};
    assert.equal((await call('/api/admin/menus','POST',{...input,photo_url:photo.replace(tenant.id,randomUUID())})).status,400);
    const menu=await call('/api/admin/menus','POST',input);assert.equal(menu.status,201);assert.equal((await menu.json()).data.stock,12);
    const qris=await upload('tenant_qris');assert.equal((await call('/api/admin/tenants/'+tenant.id,'PATCH',{qris_image_url:qris,qris_merchant_name:'Kedai Baru'})).status,200);
    assert.equal((await call('/api/admin/tenants/'+tenant.id,'PATCH',{is_active:true})).status,200);
    const catalog=(await (await call('/api/tenants','GET',undefined,true)).json()).data;assert.equal(catalog[0].id,tenant.id);assert.equal(catalog[0].qris_image_url,null);
    const products=(await (await call('/api/tenants/'+tenant.id+'/menus','GET',undefined,true)).json()).data;assert.equal(products[0].photo_url,photo);assert.equal(products[0].category,'Makanan');assert.equal(products[0].stock,12);
  }finally{await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});

test('outlet map is managed by admin, published only for active outlets and scoped to its Storage owner',async()=>{
  const admin=randomUUID(),tenant=randomUUID(),rows=new Map(),assets=new Set();
  const guard=new Media('https://qa.supabase.co',undefined);
  let hasActiveTenant=false;
  const now=()=>new Date();
  function lookup(id){
    const row=rows.get(id);
    if(!row)throw new HttpError(404,'Outlet missing');
    return row;
  }
  const tx={
    $queryRaw:async()=>[],
    outlet:{
      create:async({data})=>{const row={id:randomUUID(),floorMapUrl:null,createdAt:now(),updatedAt:now(),...data};rows.set(row.id,row);return row;},
      findFirst:async({where})=>{const row=rows.get(where.id);return row?.isActive===where.isActive?row:null;},
      findMany:async({where})=>[...rows.values()].filter(row=>where.isActive===undefined||row.isActive===where.isActive),
      findUniqueOrThrow:async({where})=>lookup(where.id),
      update:async({where,data})=>{const row={...lookup(where.id),...data,updatedAt:now()};rows.set(row.id,row);return row;},
    },
    tenant:{count:async()=>Number(hasActiveTenant)},
  };
  const server=createApp({
    db:{
      staff:async(sub,_request,work)=>work(tx,{id:sub,role:sub===admin?'admin_pengelola':'tenant',tenant_id:sub===admin?null:tenant}),
      catalog:async(_request,work)=>work(tx),
    },
    verify:async token=>token==='admin'?admin:tenant,
    accounts:{list:async()=>[],invite:async()=>{throw new Error('Unexpected invite');},setActive:async()=>{}},
    media:{
      upload:async(_bytes,purpose,owner)=>{
        assert.equal(purpose,'floor_map');
        const url='https://qa.supabase.co/storage/v1/object/authenticated/floor-maps/'+owner+'/'+randomUUID()+'.webp';
        assets.add(url);
        return url;
      },
      assertAsset:async(url,purpose,owner)=>{
        guard.path(url,purpose,owner);
        if(!assets.has(url))throw new HttpError(400,'Asset missing');
      },
      preview:async(url,owner,purpose)=>{
        assert.equal(purpose,'floor_map');
        return 'https://qa.supabase.co/storage/v1/object/sign/floor-maps/'+guard.path(url,purpose,owner)+'?token=qa';
      },
    },origins:[],
  }).listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  try{
    const base='http://127.0.0.1:'+server.address().port;
    function call(path,method='GET',body,token='admin'){
      const isForm=body instanceof FormData;
      return fetch(base+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body&&!isForm?{'Content-Type':'application/json'}:{})},body:isForm?body:JSON.stringify(body)});
    }
    const details={name:'Kantin uji',location:'Lantai dasar',floor_map_url:null};
    assert.equal((await call('/api/admin/outlets','POST',details,'tenant')).status,403);
    const created=await call('/api/admin/outlets','POST',details);
    assert.equal(created.status,201);
    const outlet=await created.json();
    const editor='/api/admin/outlets/'+outlet.id,publicPath='/api/outlets/'+outlet.id;
    assert.equal((await call(publicPath,'GET',undefined,null)).status,404);
    const image=await sharp({create:{width:32,height:16,channels:3,background:'white'}}).png().toBuffer();
    const upload=new FormData();
    upload.append('file',new Blob([image],{type:'image/png'}),'map.png');
    const uploads='/api/admin/uploads?purpose=floor_map&owner_id='+outlet.id;
    assert.equal((await call(uploads,'POST',upload,'tenant')).status,403);
    const uploaded=await call(uploads,'POST',upload);
    assert.equal(uploaded.status,201);
    const {asset_url}=await uploaded.json();
    assert.equal((await call(editor,'PATCH',{floor_map_url:asset_url.replace(outlet.id,randomUUID())})).status,400);
    assert.equal((await call(editor,'PATCH',{floor_map_url:asset_url,is_active:true})).status,200);
    assert.equal((await (await call('/api/outlets','GET',undefined,null)).json()).data[0].id,outlet.id);
    const imageResponse=await call(publicPath+'/floor-map','GET',undefined,null);
    assert.equal(imageResponse.status,200);
    assert.match((await imageResponse.json()).image_url,/\/object\/sign\/floor-maps\//);
    hasActiveTenant=true;
    assert.equal((await call(editor,'DELETE')).status,409);
    assert.equal((await call(editor,'PATCH',{is_active:false})).status,409);
    hasActiveTenant=false;
    assert.equal((await call(editor,'PATCH',{floor_map_url:null})).status,200);
    assert.equal((await call(publicPath+'/floor-map','GET',undefined,null)).status,404);
    assert.equal((await call(editor,'DELETE')).status,204);
    assert.equal((await call(publicPath,'GET',undefined,null)).status,404);
  }finally{await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});
