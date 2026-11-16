'use client';
import { useState, type FormEvent } from 'react';
import { CreateMenuRequestSchema, LIMITS, UploadMetadataSchema } from '@kantin/shared';
import { Badge, Button, EmptyState, Field, FoodPhoto, ImagePlus, Modal, Pencil, Plus, Search, UtensilsCrossed, formatMoney } from '@kantin/ui';
import { useDemo, type Category, type DemoMenu } from '@kantin/ui/demo';
export default function MenuPage() {
  const { menus, tenants, role, saveMenu } = useDemo();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DemoMenu | null>(null);
  const entries = menus.filter((item) => item.is_active && (role === 'admin_pengelola' || item.tenant_id === tenants[0]?.id) &&
    item.name.toLocaleLowerCase('id').includes(query.toLocaleLowerCase('id')) && (filter === 'all' || (filter === 'available' ? item.is_available : !item.is_available)));
  return <>
    <div className="page-intro"><div><div className="eyebrow text-action">KATALOG TENANT</div><h1 style={{ marginTop: 'var(--s2)' }}>Kelola menu</h1><p>{role === 'admin_pengelola' ? 'Tambahkan menu ke tenant yang dipilih, lalu atur harga dan ketersediaannya.' : 'Kelola menu, harga, dan ketersediaan tenant Anda.'}</p></div><Button onClick={() => { setEditing(null); setOpen(true); }}><Plus />Tambah menu</Button></div>
    <section className="panel"><div className="filters"><div className="filter-tabs">{[['all','Semua menu'],['available','Tersedia'],['unavailable','Tidak tersedia']].map(([value,label]) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value!)} aria-pressed={filter === value}>{label}</button>)}</div><div className="search-field"><Search /><input className="input" aria-label="Cari menu" placeholder="Cari nama menu..." value={query} onChange={(event) => setQuery(event.target.value)} /></div></div>
      {entries.length ? <div className="table-wrap" tabIndex={0} aria-label="Tabel menu"><table className="data-table"><thead><tr><th>Menu</th><th>Kategori</th><th>Tenant</th><th>Harga</th><th>Ketersediaan</th><th className="text-right">Aksi</th></tr></thead><tbody>
        {entries.map((menu) => <tr key={menu.id}><td><div className="row"><FoodPhoto src={menu.image} alt={menu.name} className="table-photo" /><div className="table-name"><strong>{menu.name}</strong><small>{menu.popular ? 'Menu favorit' : 'Menu reguler'}</small></div></div></td><td><Badge>{menu.category}</Badge></td><td className="muted">{tenants.find((tenant) => tenant.id === menu.tenant_id)?.name}</td><td><strong className="numeric">{formatMoney(menu.price)}</strong></td>
          <td><button className="toggle" aria-pressed={menu.is_available} aria-label={'Ketersediaan ' + menu.name} onClick={() => saveMenu({ ...menu, is_available: !menu.is_available, updated_at: new Date().toISOString() })}><span className="toggle-track" />{menu.is_available ? 'Tersedia' : 'Habis'}</button></td><td className="text-right"><Button variant="ghost" size="sm" aria-label={'Edit ' + menu.name} onClick={() => { setEditing(menu); setOpen(true); }}><Pencil />Edit</Button></td></tr>)}
      </tbody></table></div> : <EmptyState icon={<UtensilsCrossed />} title="Belum ada menu yang cocok" description="Ubah pencarian atau tambahkan menu contoh baru." />}
      <div className="table-bottom"><span>{entries.length} menu ditampilkan</span><span>Foto dan data merupakan placeholder</span></div></section>
    <Modal open={open} onOpenChange={setOpen} title={editing ? 'Edit menu' : 'Tambah menu'} description="Perubahan hanya berlaku pada data contoh di sesi ini.">
      <MenuForm key={editing?.id ?? 'new'} menu={editing} onClose={() => setOpen(false)} />
    </Modal>
  </>;
}
function MenuForm({ menu, onClose }: { menu: DemoMenu | null; onClose: () => void }) {
  const { tenants, role, saveMenu } = useDemo();
  const [name, setName] = useState(menu?.name ?? '');
  const [price, setPrice] = useState(String(menu?.price ?? ''));
  const [tenantId, setTenantId] = useState(menu?.tenant_id ?? tenants[0]?.id ?? '');
  const [category, setCategory] = useState<Category>(menu?.category ?? 'Makanan');
  const [description, setDescription] = useState(menu?.description ?? '');
  const [image, setImage] = useState(menu?.image ?? '/food/ayam.jpg');
  const [available, setAvailable] = useState(menu?.is_available ?? true);
  const [error, setError] = useState('');
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = CreateMenuRequestSchema.safeParse({ name, tenant_id: tenantId, price: Number(price), photo_url: menu?.photo_url ?? null, is_available: available });
    if (!parsed.success) { setError('Periksa nama menu (2–100 karakter), tenant, dan harga dalam Rupiah.'); return; }
    const now = new Date().toISOString();
    saveMenu({ ...parsed.data, id: menu?.id ?? crypto.randomUUID(), is_active: true, category, description, image,
      popular: menu?.popular ?? false, spicy: menu?.spicy ?? false, created_at: menu?.created_at ?? now, updated_at: now });
    onClose();
  }
  return <form className="stack" onSubmit={submit}>
    <Field label="Nama menu"><input className="input" required minLength={2} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Nasi Ayam Bakar" /></Field>
    <div className="form-grid"><Field label="Harga (Rp)"><input className="input" type="number" required min="1" max={LIMITS.maxMoneyIdr} step="1" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="18000" /></Field>
      <Field label="Kategori"><select className="select" value={category} onChange={(event) => setCategory(event.target.value as Category)}><option>Makanan</option><option>Minuman</option><option>Camilan</option></select></Field></div>
    <Field label="Tenant"><select className="select" value={tenantId} disabled={!!menu || role === 'tenant'} onChange={(event) => setTenantId(event.target.value)}>{tenants.filter((tenant) => role === 'admin_pengelola' || tenant.id === tenants[0]?.id).map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}</select></Field>
    <Field label="Deskripsi singkat"><textarea className="textarea" maxLength={250} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Apa yang membuat menu ini istimewa?" /></Field>
    <label className="upload-box"><FoodPhoto src={image} alt="Preview foto menu" /><span><strong className="row"><ImagePlus />Foto menu</strong><small className="muted">JPG, PNG, WebP · maksimal 2 MiB</small><input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Pilih foto menu" onChange={(event) => {
      const file = event.target.files?.[0]; if (!file) return;
      if (!UploadMetadataSchema.safeParse({ mime_type: file.type, size_bytes: file.size }).success) { setError('Pilih gambar JPG, PNG, atau WebP dengan ukuran maksimal 2 MiB.'); return; }
      setImage(URL.createObjectURL(file)); setError('');
    }} /></span></label>
    <p className="small muted">Gambar hanya dipreview secara lokal, belum diunggah ke Storage.</p>
    <label className="row small"><input type="checkbox" checked={available} onChange={(event) => setAvailable(event.target.checked)} />Tersedia untuk dipesan</label>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    <div className="form-actions">{menu ? <Button variant="danger" onClick={() => { saveMenu({ ...menu, is_active: false }); onClose(); }}>Nonaktifkan</Button> : null}<Button variant="outline" onClick={onClose}>Batal</Button><Button type="submit">Simpan menu</Button></div>
  </form>;
}
