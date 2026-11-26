'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ApiErrorSchema, MeResponseSchema, type User } from '@kantin/shared';
import { staffAuth } from './supabase';
type Parser<T>={parse:(value:unknown)=>T};
export type RequestData=<T>(path:string,schema:Parser<T>,method?:'GET'|'POST'|'PATCH'|'DELETE',body?:unknown)=>Promise<T>;
type State={actor:User|null;loading:boolean;error:string;request:RequestData;refreshIdentity:()=>Promise<void>;signOut:()=>Promise<void>};
const Context=createContext<State|null>(null);
export function ManagementProvider({children}:{children:ReactNode}) {
  const [actor,setActor]=useState<User|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const generation=useRef(0);
  const request=useCallback<RequestData>(async(path,schema,method='GET',body)=>{
    const identityGeneration=generation.current;
    const base=process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/,''); const auth=staffAuth();
    if(!base||!auth)throw new Error('Koneksi API atau Supabase belum dikonfigurasi.');
    const {data,error:failure}=await auth.auth.getSession();
    if(failure||!data.session)throw new Error('Silakan masuk terlebih dahulu.');
    const multipart=body instanceof FormData;
    const response=await fetch(base+path,{method,cache:'no-store',headers:{Authorization:'Bearer '+data.session.access_token,...(body===undefined||multipart?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:multipart?body:JSON.stringify(body)}),signal:AbortSignal.timeout(multipart?45000:15000)});
    if(response.status===204)return schema.parse(null);
    const json:unknown=await response.json();
    if(!response.ok) {
      const parsed=ApiErrorSchema.safeParse(json);
      if(identityGeneration===generation.current&&(response.status===401||(path==='/api/me'&&response.status===403))){
        setActor(null);
        setError(parsed.success?parsed.data.error.message:'Akses ditolak.');
      }
      throw new Error(parsed.success?parsed.data.error.message:'Permintaan belum dapat diproses.');
    }
    return schema.parse(json);
  },[]);
  const refreshIdentity=useCallback(async()=>{
    const current=++generation.current;setLoading(true);setActor(null);setError('');
    try {const response=await request('/api/me',MeResponseSchema);if(current===generation.current)setActor(response.data);}
    catch(failure:unknown){if(current===generation.current)setError(failure instanceof Error?failure.message:'Layanan belum dapat dihubungi.');}
    finally{if(current===generation.current)setLoading(false);}
  },[request]);
  useEffect(()=>{
    const auth=staffAuth();let alive=true;
    if(!auth){Promise.resolve().then(()=>{if(alive)void refreshIdentity();});return()=>{alive=false;};}
    let subject: string | null | undefined;
    const {data}=auth.auth.onAuthStateChange((_event,session)=>{
      const next=session?.user.id??null;
      if(next===subject)return;
      subject=next;
      queueMicrotask(()=>{if(alive&&subject===next)void refreshIdentity();});
    });
    return()=>{alive=false;data.subscription.unsubscribe();};
  },[refreshIdentity]);
  async function signOut(){const auth=staffAuth();if(auth){const {error:failure}=await auth.auth.signOut({scope:'local'});if(failure)throw new Error('Belum dapat keluar. Coba kembali.');}generation.current++;setActor(null);setLoading(false);setError('');}
  return <Context.Provider value={{actor,loading,error,request,refreshIdentity,signOut}}>{children}</Context.Provider>;
}
export function useManagement(){const value=useContext(Context);if(!value)throw new Error('ManagementProvider is required');return value;}
export async function collect<T>(request:RequestData,path:string,schema:Parser<{data:T[];next_cursor:string|null}>):Promise<T[]>{
  const rows:T[]=[];let cursor:string|null=null;
  for(let page=0;page<100;page++) {const response:{data:T[];next_cursor:string|null}=await request(path+(path.includes('?')?'&':'?')+'limit=100'+(cursor?'&cursor='+encodeURIComponent(cursor):''),schema);rows.push(...response.data);cursor=response.next_cursor;if(!cursor)return rows;}
  throw new Error('Data terlalu banyak. Hubungi pengelola untuk mempersempit daftar.');
}
export function useLoad<T>(load:()=>Promise<T>){
  const [state,setState]=useState<{key:typeof load;data:T|null;error:string;loading:boolean}>({key:load,data:null,error:'',loading:true});const generation=useRef(0);
  const reload=useCallback(async()=>{const current=++generation.current;setState(previous=>({...previous,key:load,loading:true,error:''}));try{const data=await load();if(current===generation.current)setState({key:load,data,error:'',loading:false});}catch(failure:unknown){if(current===generation.current)setState({key:load,data:null,error:failure instanceof Error?failure.message:'Data belum dapat dimuat.',loading:false});}},[load]);
  useEffect(()=>{
    let alive=true;const current=++generation.current;
    void load().then(data=>{if(alive&&current===generation.current)setState({key:load,data,error:'',loading:false});}).catch((failure:unknown)=>{if(alive&&current===generation.current)setState({key:load,data:null,error:failure instanceof Error?failure.message:'Data belum dapat dimuat.',loading:false});});
    return()=>{alive=false;};
  },[load]);
  return {data:state.key===load?state.data:null,error:state.key===load?state.error:'',loading:state.key!==load||state.loading,reload};
}
