'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { TenantListResponseSchema, ManagedMenusResponseSchema } from '@kantin/shared';
import { Button } from '@kantin/ui';
import { DemoProvider, type DemoMenu, type DemoTenant } from '@kantin/ui/demo';
type Catalog={tenants:DemoTenant[];menus:DemoMenu[]};
const StatusContext=createContext<{loading:boolean;error:string;retry:()=>void}|null>(null);
export function useCatalogStatus() { return useContext(StatusContext); }
export function CatalogContent({children}:{children:ReactNode}){const path=usePathname(),state=useContext(StatusContext);if(state&&(path==='/'||path==='/checkout'||path.startsWith('/tenant/'))&&(state.loading||state.error))return <section className="panel stack"><p role={state.error?'alert':'status'}>{state.loading?'Memuat menu…':state.error}</p>{state.error?<Button variant="outline" onClick={state.retry}>Coba kembali</Button>:null}</section>;return children;}
export async function pages<T>(base:string,path:string,schema:{parse:(value:unknown)=>{data:T[];next_cursor:string|null}},signal:AbortSignal):Promise<T[]>{
  const rows:T[]=[];let cursor:string|null=null;
  for(let page=0;page<100;page++){const response=await fetch(base+path+'?limit=100'+(cursor?'&cursor='+encodeURIComponent(cursor):''),{signal,cache:'no-store'});if(!response.ok)throw new Error('Menu belum dapat dimuat. Silakan coba lagi.');const json:unknown=await response.json();const result=schema.parse(json);rows.push(...result.data);cursor=result.next_cursor;if(!cursor)return rows;}
  throw new Error('Daftar menu belum dapat dimuat seluruhnya.');
}
export function LiveCatalog({children,epoch}:{children:ReactNode;epoch:number}){
  const [catalog,setCatalog]=useState<Catalog>({menus:[],tenants:[]}),[loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();let alive=true;
    const timeout=setTimeout(()=>controller.abort(),45000);
    async function load(){
      const base=process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/,'');if(!base)throw new Error('Menu belum tersedia. Silakan coba lagi nanti.');
      const tenants=await pages(base,'/api/tenants',TenantListResponseSchema,controller.signal);
      const menus:DemoMenu[]=[];
      for(let index=0;index<tenants.length;index+=5){const batches=await Promise.all(tenants.slice(index,index+5).map(tenant=>pages(base,'/api/tenants/'+tenant.id+'/menus',ManagedMenusResponseSchema,controller.signal)));for(const batch of batches)menus.push(...batch.map(menu=>({...menu,image:menu.photo_url??'/food/fallback.svg',popular:false,spicy:false,is_available:menu.is_available&&menu.stock>0})));}
      return {menus,tenants:tenants.map(tenant=>({...tenant,email:'',tagline:tenant.description}))};
    }
    void load().then(value=>{if(alive){setCatalog(value);setError('');setLoading(false);}}).catch(()=>{if(alive){setError('Menu belum dapat dimuat. Silakan coba lagi.');setLoading(false);}});
    return()=>{alive=false;clearTimeout(timeout);controller.abort();};
  },[revision]);
  return <DemoProvider key={epoch} surface="user" catalog={catalog} persistCart><StatusContext.Provider value={{loading,error,retry:()=>{setLoading(true);setRevision(value=>value+1);}}}>{children}</StatusContext.Provider></DemoProvider>;
}
