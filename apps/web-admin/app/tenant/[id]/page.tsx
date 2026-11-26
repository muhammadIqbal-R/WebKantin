import { Suspense } from 'react';
import { IdSchema } from '@kantin/shared';
import { MenuManagement } from '@kantin/staff/menu';
export default function Page({params}:{params:Promise<{id:string}>}){return <Suspense fallback={<p role="status">Memuat tenant…</p>}><TenantPage params={params}/></Suspense>;}
async function TenantPage({params}:{params:Promise<{id:string}>}){const {id}=await params;const valid=IdSchema.safeParse(id);if(!valid.success)return <section className="panel"><h1>Tenant tidak ditemukan</h1></section>;return <MenuManagement fixedTenantId={valid.data}/>;}
