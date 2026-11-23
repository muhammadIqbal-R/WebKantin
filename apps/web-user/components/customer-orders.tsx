'use client';
import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {ApiErrorSchema,CreateOrdersRequestSchema,CreateOrdersResponseSchema,OwnedOrdersResponseSchema,OrderResponseSchema,OrderDetailResponseSchema,PaymentInstructionsResponseSchema,OrderSignalSchema,type Order,type CreateOrdersRequest} from '@kantin/shared';
import {getCustomerAuthClient} from '../lib/supabase';
import {useCustomerAuth} from './customer-auth';
type Detail=ReturnType<typeof OwnedOrdersResponseSchema.parse>['data'][number];
type Payment=ReturnType<typeof PaymentInstructionsResponseSchema.parse>;
type Value={orders:Detail[];loading:boolean;error:string;next:string|null;reload:()=>Promise<void>;older:()=>Promise<void>;create:(input:CreateOrdersRequest)=>Promise<void>;paid:(order:Order)=>Promise<void>;payment:(id:string)=>Promise<Payment>};
const Context=createContext<Value|null>(null);
export function CustomerOrders({children}:{children:ReactNode}){const {user}=useCustomerAuth();return <OwnedProvider key={user?.id??'guest'} subject={user?.id??null}>{children}</OwnedProvider>;}
function OwnedProvider({children,subject}:{children:ReactNode;subject:string|null}){
 const [orders,setOrders]=useState<Detail[]>([]),[loading,setLoading]=useState(!!subject),[error,setError]=useState(''),[next,setNext]=useState<string|null>(null);const pages=useRef(false),generation=useRef(0),pending=useRef<{signature:string;key:string}|null>(null);
 const api=useCallback(async<T,>(path:string,schema:{parse:(value:unknown)=>T},method='GET',body?:unknown,extra?:Record<string,string>):Promise<T>=>{const base=process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/,''),auth=getCustomerAuthClient();if(!base||!auth||!subject)throw new Error('Masuk ke akun pelanggan untuk melanjutkan.');const session=await auth.auth.getSession();if(!session.data.session||session.data.session.user.id!==subject)throw new Error('Sesi sudah berakhir. Silakan masuk kembali.');const response=await fetch(base+path,{method,cache:'no-store',headers:{Authorization:'Bearer '+session.data.session.access_token,...(body===undefined?{}:{'Content-Type':'application/json'}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});const value:unknown=await response.json();if(!response.ok){if(response.status===401||response.status===403)setOrders([]);const parsed=ApiErrorSchema.safeParse(value);throw new Error(parsed.success?parsed.data.error.message:'Pesanan belum dapat dimuat.');}return schema.parse(value);},[subject]);
 const merge=useCallback((items:Detail[])=>setOrders(old=>{
  const map=new Map(old.map(item=>[item.data.id,item]));
  for(const item of items){
   const current=map.get(item.data.id);
   if(!current||item.data.version>=current.data.version)map.set(item.data.id,item);
  }
  return [...map.values()].sort((a,b)=>b.data.created_at.localeCompare(a.data.created_at)||b.data.id.localeCompare(a.data.id));
 }),[]);
 const reload=useCallback(async()=>{if(!subject)return;const current=++generation.current;try{const response=await api('/api/orders?limit=100',OwnedOrdersResponseSchema);if(current===generation.current){merge(response.data);if(!pages.current)setNext(response.next_cursor);setError('');}}catch(failure:unknown){if(current===generation.current)setError(failure instanceof Error?failure.message:'Pesanan belum dapat dimuat.');}finally{if(current===generation.current)setLoading(false);}},[subject,api,merge]);
 useEffect(()=>{if(!subject)return;let alive=true;let running=false,connected=false,lastSync=0;async function sync(){if(!alive||running)return;running=true;lastSync=Date.now();try{await reload();}finally{running=false;}}void sync();const timer=setInterval(()=>{if(!connected||Date.now()-lastSync>=30000)void sync();},5000);const auth=getCustomerAuthClient();const channel=auth?.channel('customer-orders-'+subject).on('postgres_changes',{event:'*',schema:'public',table:'orders',filter:'customer_id=eq.'+subject},payload=>{const event=OrderSignalSchema.safeParse(payload.new);if(event.success)void api('/api/orders/'+event.data.id,OrderDetailResponseSchema).then(detail=>{if(alive)merge([detail]);}).catch(()=>void sync());}).subscribe(status=>{connected=status==='SUBSCRIBED';if(connected)void sync();});return()=>{alive=false;clearInterval(timer);if(channel&&auth)void auth.removeChannel(channel);};},[subject,reload,api,merge]);
 async function create(input:CreateOrdersRequest){if(!subject)throw new Error('Silakan masuk.');const value=CreateOrdersRequestSchema.parse(input);value.items.sort((a,b)=>a.menu_id.localeCompare(b.menu_id));const signature=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))).map(byte=>byte.toString(16).padStart(2,'0')).join('');const storage='kantin-checkout-'+subject;
  try{const saved:unknown=JSON.parse(sessionStorage.getItem(storage)??'null');if(saved&&typeof saved==='object'&&'signature'in saved&&saved.signature===signature&&'key'in saved&&typeof saved.key==='string')pending.current={signature,key:saved.key};}catch{}
  if(pending.current?.signature!==signature)pending.current={signature,key:crypto.randomUUID()};try{sessionStorage.setItem(storage,JSON.stringify(pending.current));}catch{}
  await api('/api/orders',CreateOrdersResponseSchema,'POST',value,{'Idempotency-Key':pending.current.key});pending.current=null;try{sessionStorage.removeItem(storage);}catch{}await reload();
 }
 async function paid(order:Order){
  const response=await api('/api/orders/'+order.id+'/paid',OrderResponseSchema,'PATCH',{expected_version:order.version});
  setOrders(old=>old.map(item=>item.data.id===order.id&&response.data.version>item.data.version
    ? {data:response.data,items:item.items} : item));
  await reload();
 }
 const payment=useCallback(async(id:string)=>api('/api/orders/'+id+'/payment',PaymentInstructionsResponseSchema),[api]);
 async function older(){if(!next)return;const response=await api('/api/orders?limit=100&cursor='+encodeURIComponent(next),OwnedOrdersResponseSchema);pages.current=true;merge(response.data);setNext(response.next_cursor);}
 return <Context.Provider value={{orders,loading,error,next,reload:async()=>{pages.current=false;setOrders([]);await reload();},older,create,paid,payment}}>{children}</Context.Provider>;
}
export function useCustomerOrders(){const value=useContext(Context);if(!value)throw new Error('CustomerOrders provider required');return value;}
