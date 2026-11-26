'use client';
import { useState, type FormEvent } from 'react';
import { ManagedTenantResponseSchema, UploadResponseSchema, type ManagedTenant } from '@kantin/shared';
import { Badge, Button, Field } from '@kantin/ui';
import { ImageField } from './image-field';
import { useManagement } from './management';
export function TenantSettings({tenant,ready,reload}:{tenant:ManagedTenant;ready:boolean;reload:()=>Promise<void>}){
  const {request,actor}=useManagement();const [merchant,setMerchant]=useState(tenant.qris_merchant_name??''),[file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  if(actor?.role!=='admin_pengelola')return null;
  async function save(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError('');try{
    let asset=tenant.qris_image_url;
    if(file){const body=new FormData();body.append('file',file);asset=(await request('/api/admin/uploads?purpose=tenant_qris&owner_id='+tenant.id,UploadResponseSchema,'POST',body)).asset_url;}
    if(!asset)throw new Error('Pilih gambar QRIS tenant.');
    await request('/api/admin/tenants/'+tenant.id,ManagedTenantResponseSchema,'PATCH',{qris_merchant_name:merchant,...(file?{qris_image_url:asset}:{})});setFile(null);setNotice('QRIS tenant tersimpan.');await reload();
  }catch(failure:unknown){setError(failure instanceof Error?failure.message:'QRIS belum dapat disimpan.');}finally{setBusy(false);}}
  async function activate(){setBusy(true);setError('');try{await request('/api/admin/tenants/'+tenant.id,ManagedTenantResponseSchema,'PATCH',{is_active:!tenant.is_active});setNotice('Status tenant diperbarui.');await reload();}catch(failure:unknown){setError(failure instanceof Error?failure.message:'Status belum dapat disimpan.');}finally{setBusy(false);}}
  return <section className="panel stack"><div className="panel-header"><h2>Pembayaran & aktivasi</h2><Badge tone={tenant.is_active?'success':'neutral'}>{tenant.archived_at?'Arsip':tenant.is_active?'Aktif':'Draft'}</Badge></div><p className="small muted">Lengkapi QRIS dan menu dengan stok sebelum menampilkan tenant di katalog.</p><form className="stack" onSubmit={save}><Field label="Nama merchant pada QRIS"><input className="input" required minLength={2} maxLength={150} value={merchant} disabled={busy||!!tenant.archived_at} onChange={e=>setMerchant(e.target.value)}/></Field><ImageField label="Gambar QRIS tenant" file={file} current={tenant.qris_preview_url??null} onChange={setFile} disabled={busy||!!tenant.archived_at}/><div className="form-actions"><Button type="submit" variant="outline" loading={busy} disabled={!!tenant.archived_at}>Simpan QRIS</Button><Button disabled={busy||!!tenant.archived_at||(!tenant.is_active&&(!tenant.qris_image_url||!tenant.qris_merchant_name||!ready))} onClick={()=>void activate()}>{tenant.is_active?'Nonaktifkan tenant':'Aktifkan tenant'}</Button></div></form>{notice?<p role="status">{notice}</p>:null}{error?<p className="form-error" role="alert">{error}</p>:null}</section>;
}
