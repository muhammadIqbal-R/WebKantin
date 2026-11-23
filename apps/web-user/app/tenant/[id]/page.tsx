import {Suspense} from 'react';
import {IdSchema} from '@kantin/shared';
import {TenantMenu} from '../../../components/tenant-menu';
export default function Page({params}:{params:Promise<{id:string}>}){return <Suspense fallback={<p role="status">Memuat menu…</p>}><Menu params={params}/></Suspense>;}
async function Menu({params}:{params:Promise<{id:string}>}){const value=IdSchema.safeParse((await params).id);return value.success?<TenantMenu tenantId={value.data}/>:<section className="panel"><h1>Tenant tidak ditemukan</h1></section>;}
