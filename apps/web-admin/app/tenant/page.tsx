'use client';
import Link from 'next/link';
import { useCallback, useState, type FormEvent } from 'react';
import { ManagedTenantsResponseSchema, ManagedMenusResponseSchema, OutletListResponseSchema, ManagedTenantResponseSchema, MeResponseSchema, type ManagedTenant } from '@kantin/shared';
import { Badge, Button, Field, Modal, Plus, Store } from '@kantin/ui';
import { collect, useLoad, useManagement } from '@kantin/staff/management';
import { DataState } from '@kantin/staff/data-state';
import {VendorImport} from '../../components/vendor-import';
import {TenantAccountFields} from '../../components/tenant-account-fields';
const single=ManagedTenantResponseSchema;
export default function TenantsPage(){
  const {request,actor}=useManagement();
  const load=useCallback(async()=>{const [tenants,menus,outlets]=await Promise.all([collect(request,'/api/admin/tenants',ManagedTenantsResponseSchema),collect(request,'/api/admin/menus',ManagedMenusResponseSchema),collect(request,'/api/admin/outlets',OutletListResponseSchema)]);return {tenants,menus,outlets};},[request]);
  const state=useLoad(load);const [form,setForm]=useState<'edit'|'account'|null>(null),[selected,setSelected]=useState<ManagedTenant|null>(null),[confirm,setConfirm]=useState<ManagedTenant|null>(null);
  const [name,setName]=useState(''),[description,setDescription]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  if(actor?.role!=='admin_pengelola')return <section className="panel"><h1>Akses khusus admin</h1></section>;
  function open(kind:'edit'|'account',tenant:ManagedTenant){
    setSelected(tenant);
    setName(tenant.name);
    setDescription(tenant.description);
    setEmail('');
    setPassword('');
    setError('');
    setForm(kind);
  }

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!selected||!form||busy)return;
    setBusy(true);
    setError('');
    try {
      if(form==='account'){
        await request('/api/admin/tenant-accounts',MeResponseSchema,'POST',{tenant_id:selected.id,email,password});
        setNotice('Akun tenant dibuat. Gunakan portal tenant untuk masuk.');
      } else {
        await request('/api/admin/tenants/'+selected.id,single,'PATCH',{name,description});
        setNotice('Tenant diperbarui.');
      }
      setPassword('');
      setForm(null);
      await state.reload();
    }catch(failure:unknown){setError(failure instanceof Error?failure.message:'Perubahan gagal.');}
    finally{setBusy(false);}
  }
  async function change(tenant:ManagedTenant,archived?:boolean){setBusy(true);setError('');try{await request('/api/admin/tenants/'+tenant.id,single,'PATCH',archived===undefined?{is_active:!tenant.is_active}:{archived});setConfirm(null);setNotice(archived===undefined?'Status tenant diperbarui.':archived?'Tenant diarsipkan.':'Tenant dipulihkan sebagai draft.');await state.reload();}catch(failure:unknown){setError(failure instanceof Error?failure.message:'Perubahan gagal.');}finally{setBusy(false);}}
  return <><div className="page-intro"><div><h1>Tenant kantin</h1><p>Kelola penjual dan akun tenant.</p></div><Button asChild><Link href="/tenant/daftar"><Plus/>Daftarkan tenant</Link></Button></div><DataState {...state} retry={state.reload}/>{state.data?<VendorImport outlets={state.data.outlets} done={state.reload}/>:null}{notice?<p className="notice" role="status">{notice}</p>:null}{error&&!form&&!confirm?<p className="form-error" role="alert">{error}</p>:null}
    <div className="admin-tenant-grid">{state.data?.tenants.map(tenant=>{const menus=(state.data?.menus??[]).filter(menu=>menu.tenant_id===tenant.id),count=menus.length,stock=menus.reduce((sum,menu)=>sum+menu.stock,0);const ready=!!tenant.qris_image_url&&!!tenant.qris_merchant_name&&menus.some(menu=>menu.stock>0&&menu.is_available);return <article className="panel stack" key={tenant.id}><div className="row between wrap"><h2 className="row"><Store/>{tenant.name}</h2><Badge tone={tenant.is_active?'success':'neutral'}>{tenant.archived_at?'Arsip':tenant.is_active?'Aktif':'Draft'}</Badge></div><p className="small muted">{tenant.description||'Belum ada deskripsi.'}</p><p>{count} menu · {stock} porsi</p>{!tenant.archived_at&&!ready?<p className="small muted">Lengkapi QRIS dan menu dengan stok melalui Kelola tenant.</p>:null}<div className="form-actions"><Button size="sm" asChild><Link href={'/tenant/'+tenant.id}>Kelola tenant</Link></Button><Button size="sm" variant="outline" disabled={busy||!!tenant.archived_at} onClick={()=>open('edit',tenant)}>Edit</Button><Button size="sm" variant="outline" disabled={busy||!!tenant.archived_at} onClick={()=>open('account',tenant)}>Buat akun</Button>{!tenant.archived_at?<Button size="sm" variant="outline" disabled={busy||(!tenant.is_active&&!ready)} onClick={()=>void change(tenant)}>{tenant.is_active?'Nonaktifkan':'Aktifkan'}</Button>:null}<Button size="sm" variant={tenant.archived_at?'outline':'danger'} disabled={busy} onClick={()=>{setConfirm(tenant);setError('');}}>{tenant.archived_at?'Pulihkan':'Arsipkan'}</Button></div></article>;})}</div>
    {!state.loading&&!state.error&&state.data?.tenants.length===0?<section className="panel"><p>Belum ada tenant. Tambahkan tenant pertama.</p></section>:null}
    <Modal open={form!==null} onOpenChange={open=>{if(!busy&&!open){setPassword('');setForm(null);}}}
      title={form==='account'?'Buat akun tenant':'Edit tenant'} description={selected?.name??''}>
      <form className="stack" onSubmit={submit}>
        {form==='account'
          ? <TenantAccountFields email={email} password={password} onEmail={setEmail} onPassword={setPassword} disabled={busy} />
          : <>
            <Field label="Nama tenant"><input className="input" required minLength={2} maxLength={100}
              value={name} onChange={event=>setName(event.target.value)} /></Field>
            <Field label="Deskripsi"><textarea className="textarea" maxLength={1000}
              value={description} onChange={event=>setDescription(event.target.value)} /></Field>
          </>}
        {error&&<p className="form-error" role="alert">{error}</p>}
        <div className="form-actions">
          <Button variant="outline" disabled={busy} onClick={()=>{setPassword('');setForm(null);}}>Batal</Button>
          <Button type="submit" loading={busy}>{form==='account'?'Buat akun':'Simpan tenant'}</Button>
        </div>
      </form>
    </Modal>
    <Modal open={!!confirm} onOpenChange={open=>{if(!busy&&!open)setConfirm(null);}} title={confirm?.archived_at?'Pulihkan tenant?':'Arsipkan tenant?'} description={confirm?.archived_at?'Tenant dipulihkan sebagai draft.':'Penjualan baru ditutup. Riwayat pesanan tetap tersimpan.'}>{error?<p className="form-error" role="alert">{error}</p>:null}<div className="form-actions"><Button variant="outline" disabled={busy} onClick={()=>setConfirm(null)}>Batal</Button><Button loading={busy} onClick={()=>{if(confirm)void change(confirm,!confirm.archived_at);}}>{confirm?.archived_at?'Pulihkan':'Arsipkan'}</Button></div></Modal></>;
}
