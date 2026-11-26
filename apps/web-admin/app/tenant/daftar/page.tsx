'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState, type FormEvent } from 'react';
import { CreateTenantAccountRequestSchema, CreateTenantRequestSchema, ManagedTenantResponseSchema, MeResponseSchema, OutletListResponseSchema } from '@kantin/shared';
import { Button, Field } from '@kantin/ui';
import { DataState } from '@kantin/staff/data-state';
import { collect, useLoad, useManagement } from '@kantin/staff/management';
import { TenantAccountFields } from '../../../components/tenant-account-fields';

export default function RegisterTenantPage() {
  const router=useRouter();
  const {request}=useManagement();
  const load=useCallback(()=>collect(request,'/api/admin/outlets',OutletListResponseSchema),[request]);
  const outlets=useLoad(load);
  const activeOutlets=outlets.data?.filter(outlet=>outlet.is_active)??[];
  const [name,setName]=useState('');
  const [description,setDescription]=useState('');
  const [outlet,setOutlet]=useState('');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [draft,setDraft]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');

  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(busy)return;
    const account=CreateTenantAccountRequestSchema.omit({tenant_id:true})
      .safeParse({email,password});
    if(!account.success){setError('Periksa email dan panjang password awal.');return;}
    setBusy(true);
    setError('');
    try {
      let tenantId=draft;
      if(!tenantId){
        const tenant=CreateTenantRequestSchema.safeParse({
          outlet_id:outlet||activeOutlets[0]?.id,name,description,qris_image_url:null,qris_merchant_name:null,
        });
        if(!tenant.success)throw new Error('Periksa nama tenant, deskripsi, dan lokasi kantin.');
        const created=await request('/api/admin/tenants',ManagedTenantResponseSchema,'POST',tenant.data);
        tenantId=created.data.id;
        setDraft(tenantId);
      }
      await request('/api/admin/tenant-accounts',MeResponseSchema,'POST',{tenant_id:tenantId,...account.data});
      setPassword('');
      router.push('/tenant/'+tenantId);
    } catch (failure) {
      setError(failure instanceof Error?failure.message:'Pendaftaran tenant belum selesai.');
    } finally {setBusy(false);}
  }

  return <>
    <div className="page-intro"><h1>Daftarkan tenant</h1></div>
    <section className="panel stack">
      <DataState {...outlets} retry={outlets.reload} />
      {!outlets.loading&&!outlets.error&&!activeOutlets.length&&!draft&&<p className="notice">
        Tambahkan lokasi kantin aktif di menu Denah.
      </p>}
      <form className="stack" onSubmit={submit}>
        <Field label="Nama tenant"><input className="input" required minLength={2} maxLength={100}
          disabled={busy||!!draft} value={name} onChange={event=>setName(event.target.value)} /></Field>
        <Field label="Deskripsi"><textarea className="textarea" maxLength={1000} disabled={busy||!!draft}
          value={description} onChange={event=>setDescription(event.target.value)} /></Field>
        <Field label="Lokasi kantin"><select className="select" required disabled={busy||!!draft}
          value={outlet||activeOutlets[0]?.id||''} onChange={event=>setOutlet(event.target.value)}>
          {activeOutlets.map(location=><option key={location.id} value={location.id}>{location.name}</option>)}
        </select></Field>
        <TenantAccountFields email={email} password={password} onEmail={setEmail} onPassword={setPassword} disabled={busy} />
        {error&&<p className="form-error" role="alert">{error}</p>}
        {draft&&error&&<p className="notice">Draft tenant tersimpan. Kamu bisa mencoba membuat akun lagi atau melengkapi QRIS dan menu dulu.</p>}
        <div className="form-actions">
          {(draft&&error)&&<Button asChild variant="outline"><Link href={'/tenant/'+draft}>Buka detail tenant</Link></Button>}
          <Button type="submit" loading={busy} disabled={!draft&&(outlets.loading||!!outlets.error||!activeOutlets.length)}>
            {draft?'Buat akun tenant':'Simpan dan lengkapi menu'}
          </Button>
        </div>
      </form>
    </section>
  </>;
}
