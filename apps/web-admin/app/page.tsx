'use client';
import Link from 'next/link';
import { useCallback } from 'react';
import { ManagedMenusResponseSchema, ManagedTenantsResponseSchema } from '@kantin/shared';
import { Button } from '@kantin/ui';
import { collect,useLoad,useManagement } from '../components/management';
import { DataState } from '../components/data-state';
export default function DashboardPage(){
  const {request,actor}=useManagement();
  const load=useCallback(async()=>{const [menus,tenants]=await Promise.all([collect(request,'/api/admin/menus',ManagedMenusResponseSchema),collect(request,'/api/admin/tenants',ManagedTenantsResponseSchema)]);return {menus,tenants};},[request]);const state=useLoad(load);
  return <><div className="page-intro"><div><h1>{actor?.role==='tenant'?'Ringkasan tenant':'Ringkasan kantin'}</h1><p>Menu dan stok saat ini.</p></div><Button asChild><Link href="/menu">Kelola menu & stok</Link></Button></div><DataState {...state} retry={state.reload}/>{state.data?<><div className="operations-summary"><div><span>Tenant</span><strong>{state.data.tenants.filter(tenant=>!tenant.archived_at).length}</strong></div><div><span>Menu aktif</span><strong>{state.data.menus.length}</strong></div><div><span>Stok tersedia</span><strong>{state.data.menus.reduce((sum,menu)=>sum+menu.stock,0)}</strong><small>porsi</small></div><div><span>Menu habis</span><strong>{state.data.menus.filter(menu=>menu.stock===0).length}</strong></div></div><section className="panel"><h2>Menu perlu diisi ulang</h2>{state.data.menus.filter(menu=>menu.stock===0).map(menu=><div className="settings-row" key={menu.id}><strong>{menu.name}</strong><span>0 porsi</span></div>)}{!state.data.menus.some(menu=>menu.stock===0)?<p className="small muted">Tidak ada menu yang kehabisan stok.</p>:null}</section></>:null}</>;
}
