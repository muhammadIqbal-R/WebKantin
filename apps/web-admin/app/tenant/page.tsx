'use client';
import { useState, type FormEvent } from 'react';
import { CreateTenantAccountRequestSchema, CreateTenantRequestSchema } from '@kantin/shared';
import { Badge, Button, CheckCircle2, CircleAlert, EmptyState, Field, Modal, Plus, QrCode, Store, UtensilsCrossed } from '@kantin/ui';
import { OUTLET_ID, useDemo } from '@kantin/ui/demo';
export default function TenantsPage() {
  const { tenants, menus, role, addTenant, toggleTenant } = useDemo();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = CreateTenantRequestSchema.safeParse({ outlet_id: OUTLET_ID, name, description, qris_image_url: null, qris_merchant_name: null });
    const account = CreateTenantAccountRequestSchema.shape.email.safeParse(email);
    if (!parsed.success || !account.success) { setError('Isi nama tenant minimal 2 karakter dan email pengelola yang valid.'); return; }
    addTenant(parsed.data.name, parsed.data.description, account.data); setOpen(false); setName(''); setDescription(''); setEmail(''); setError('');
  }
  if (role === 'tenant') return <section className="panel"><EmptyState icon={<Store />} title="Halaman khusus Admin Pengelola" description="Akun tenant mengelola menu dan pesanan miliknya. Pengelolaan tenant dilakukan admin." /></section>;
  return <>
    <div className="page-intro"><div><div className="eyebrow text-action">PENGELOLAAN TENANT</div><h1 style={{ marginTop: 'var(--s2)' }}>Tenant kantin</h1><p>Tambahkan tenant dan tentukan akun pengelolanya.</p></div><Button onClick={() => { setOpen(true); setError(''); }}><Plus />Tambah tenant</Button></div>
    <div className="notice" style={{ marginBottom: 'var(--s6)' }}><Store /><span><strong>Kantin Fakultas</strong> · {tenants.length} tenant contoh, {tenants.filter((tenant) => tenant.is_active).length} aktif. Tenant baru dimulai sebagai draft.</span></div>
    <div className="admin-tenant-grid">{tenants.map((tenant) => {
      const count = menus.filter((menu) => menu.tenant_id === tenant.id && menu.is_active).length;
      return <article className="panel" key={tenant.id}><div className="tenant-detail"><span className="tenant-avatar">{tenant.name.split(' ').slice(0,2).map((part) => part[0]).join('')}</span><div><h2>{tenant.name}</h2><p>Kantin Fakultas</p></div><Badge tone={tenant.is_active ? 'success' : 'neutral'}>{tenant.is_active ? 'Aktif' : 'Draft'}</Badge></div>
        <p className="small muted">{tenant.description || 'Deskripsi tenant belum ditambahkan.'}</p>
        <ul className="tenant-checklist"><li><CheckCircle2 />Profil tenant diisi</li><li className={count ? '' : 'pending'}>{count ? <CheckCircle2 /> : <CircleAlert />}{count} menu ditambahkan</li>
          <li className="pending"><QrCode />QRIS masih placeholder</li><li><CheckCircle2 />Email pengelola diisi</li></ul>
        <p className="small muted">{tenant.email}</p><div className="tenant-footer" style={{ marginTop: 'var(--s4)' }}><span className="row small muted"><UtensilsCrossed />{count} menu</span>
          <button className="toggle" aria-pressed={tenant.is_active} disabled={!tenant.qris_merchant_name || count === 0} aria-label={'Status aktif ' + tenant.name} onClick={() => toggleTenant(tenant.id)}><span className="toggle-track" />{tenant.is_active ? 'Aktif' : tenant.qris_merchant_name && count > 0 ? 'Nonaktif' : 'Lengkapi setup'}</button></div>
      </article>;
    })}</div>
    <Modal open={open} onOpenChange={setOpen} title="Tambah tenant baru" description="Tambahkan data contoh untuk penjual berikutnya di kantin fakultas.">
      <form className="stack" onSubmit={submit}><Field label="Nama tenant"><input className="input" required minLength={2} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Kedai Rasa" /></Field>
        <Field label="Deskripsi"><textarea className="textarea" maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ceritakan singkat menu atau ciri khas tenant" /></Field>
        <Field label="Email pengelola" hint="Pada pratinjau ini, tidak ada undangan atau akun yang dibuat."><input className="input" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="pengelola@example.com" /></Field>
        <Field label="Lokasi"><input className="input" readOnly value="Kantin Fakultas" /></Field><p className="notice small"><QrCode />Setelah ditambahkan, lengkapi menu dan QRIS sebelum tenant menerima pesanan.</p>
        {error ? <p className="form-error" role="alert">{error}</p> : null}<div className="form-actions"><Button variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button type="submit"><Plus />Tambahkan tenant</Button></div></form>
    </Modal>
  </>;
}
