'use client';

import { useCallback, useState, type FormEvent } from 'react';
import {
  collectMenuCategories, DEFAULT_MENU_CATEGORIES, ManagedMenuResponseSchema, ManagedMenusResponseSchema,
  ManagedTenantResponseSchema, ManagedTenantsResponseSchema, MAX_MENU_CATEGORY_LENGTH, menuCategoryKey,
  MenuCategorySchema, MenuPriceInputSchema, StockUpdateSchema, UploadResponseSchema, type ManagedMenu,
} from '@kantin/shared';
import { Badge, Button, Field, Modal, Plus, Search, FoodPhoto, formatMoney } from '@kantin/ui';
import { collect, useLoad, useManagement } from './management';
import { DataState } from './data-state';
import { ImageField } from './image-field';
import { TenantSettings } from './tenant-settings';

const empty = { parse: () => null };
const availabilityFilters = [['all', 'Semua'], ['available', 'Tersedia'], ['empty', 'Habis / dijeda']] as const;
type Mode = 'new' | 'edit' | 'stock' | 'delete';

export function MenuManagement({ fixedTenantId }: { fixedTenantId?: string }) {
  const { request, actor } = useManagement();
  const load = useCallback(async () => {
    const [menus, tenants] = await Promise.all([
      collect(request, '/api/admin/menus' + (fixedTenantId ? '?tenant_id=' + fixedTenantId : ''), ManagedMenusResponseSchema),
      fixedTenantId
        ? request('/api/admin/tenants/' + fixedTenantId, ManagedTenantResponseSchema).then(response => [response.data])
        : collect(request, '/api/admin/tenants', ManagedTenantsResponseSchema),
    ]);
    return { menus, tenants };
  }, [request, fixedTenantId]);
  const state = useLoad(load);

  const [photo, setPhoto] = useState<File | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<(typeof availabilityFilters)[number][0]>('all');
  const [mode, setMode] = useState<Mode | null>(null);
  const [selected, setSelected] = useState<ManagedMenu | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('0');
  const [tenantId, setTenantId] = useState('');
  const [category, setCategory] = useState<string>(DEFAULT_MENU_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState(false);
  const [description, setDescription] = useState('');
  const [available, setAvailable] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const tenantOptions = state.data?.tenants.filter(tenant => !tenant.archived_at) ?? [];
  const tenantCategories = collectMenuCategories([
    ...DEFAULT_MENU_CATEGORIES,
    ...(state.data?.menus.filter(menu => menu.tenant_id === tenantId).map(menu => menu.category) ?? []),
  ]);
  const priceResult = MenuPriceInputSchema.safeParse(price);

  function open(next: Mode, menu: ManagedMenu | null) {
    setMode(next);
    setSelected(menu);
    setPhoto(null);
    setName(menu?.name ?? '');
    setPrice(menu ? String(menu.price) : '');
    setStock(String(menu?.stock ?? 0));
    setTenantId(menu?.tenant_id ?? fixedTenantId ?? actor?.tenant_id ?? tenantOptions[0]?.id ?? '');
    setCategory(menu?.category ?? DEFAULT_MENU_CATEGORIES[0]);
    setCustomCategory(false);
    setDescription(menu?.description ?? '');
    setAvailable(menu?.is_available ?? true);
    setError('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mode || busy) return;

    setError('');
    let details: { name: string; price: number; category: string; description: string; is_available: boolean } | undefined;
    if (mode === 'new' || mode === 'edit') {
      if (!priceResult.success) {
        setError('Masukkan harga Rupiah antara 1 dan 1.000.000.000. Contoh 20000 atau 20.000.');
        return;
      }
      const parsedCategory = MenuCategorySchema.safeParse(category);
      if (!parsedCategory.success) {
        setError('Isi nama kategori dengan 1–40 karakter.');
        return;
      }
      details = {
        name, price: priceResult.data, description, is_available: available,
        category: tenantCategories.get(menuCategoryKey(parsedCategory.data)) ?? parsedCategory.data,
      };
    }

    setBusy(true);
    try {
      if (details) {
        let photoUrl: string | undefined;
        if (photo) {
          const body = new FormData();
          body.append('file', photo);
          photoUrl = (await request('/api/admin/uploads?purpose=menu_photo&owner_id=' + tenantId, UploadResponseSchema, 'POST', body)).asset_url;
        }
        if (mode === 'edit' && selected) {
          await request('/api/admin/menus/' + selected.id, ManagedMenuResponseSchema, 'PATCH', {
            ...details, ...(photoUrl ? { photo_url: photoUrl } : {}),
          });
        } else if (mode === 'new') {
          await request('/api/admin/menus', ManagedMenuResponseSchema, 'POST', {
            ...details, tenant_id: tenantId, stock: Number(stock), photo_url: photoUrl ?? null,
          });
        }
      } else if (mode === 'stock' && selected) {
        const payload = StockUpdateSchema.parse({ stock: Number(stock), expected_version: selected.stock_version });
        await request('/api/admin/menus/' + selected.id + '/stock', ManagedMenuResponseSchema, 'PATCH', payload);
      } else if (mode === 'delete' && selected) {
        await request('/api/admin/menus/' + selected.id, empty, 'DELETE', {});
      }

      setMode(null);
      setNotice('Perubahan menu tersimpan.');
      await state.reload();
    } catch (failure: unknown) {
      setError(failure instanceof Error ? failure.message : 'Perubahan gagal.');
    } finally {
      setBusy(false);
    }
  }

  const menus = state.data?.menus.filter(menu => {
    const matchesName = menu.name.toLocaleLowerCase('id').includes(query.toLocaleLowerCase('id'));
    const inStock = menu.is_available && menu.stock > 0;
    return matchesName && (filter === 'all' || (filter === 'available' ? inStock : !inStock));
  }) ?? [];

  return <>
    <div className="page-intro">
      <div><h1>{fixedTenantId ? state.data?.tenants[0]?.name ?? 'Tenant' : 'Menu & stok'}</h1><p>Atur harga, kategori, dan stok menu.</p></div>
      <Button disabled={state.loading || !!state.error || busy || !tenantOptions.length} onClick={() => open('new', null)}><Plus />Tambah menu</Button>
    </div>
    <DataState {...state} retry={state.reload} />
    {notice && <p className="notice" role="status">{notice}</p>}
    <div className="stack">
      {fixedTenantId && state.data?.tenants[0] && <TenantSettings tenant={state.data.tenants[0]} ready={state.data.menus.some(menu => menu.stock > 0 && menu.is_available)} reload={state.reload} />}
      <section className="panel">
        <div className="filters">
          <div className="filter-tabs">{availabilityFilters.map(([value, label]) =>
            <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>,
          )}</div>
          <div className="search-field"><Search /><input className="input" aria-label="Cari menu" placeholder="Cari nama menu" value={query} onChange={event => setQuery(event.target.value)} /></div>
        </div>
        <div className="table-wrap" tabIndex={0} aria-label="Tabel menu dan stok">
          <table className="data-table">
            <thead><tr><th>Menu</th><th>Tenant</th><th>Harga</th><th>Stok</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>{menus.map(menu => {
              const tenant = state.data?.tenants.find(entry => entry.id === menu.tenant_id);
              return <tr key={menu.id}>
                <td>
                  {menu.photo_url && <FoodPhoto src={menu.photo_url} alt={menu.name} className="table-photo" />}
                  <strong>{menu.name}</strong><p className="small muted">{menu.category}</p>
                </td>
                <td>{tenant?.name ?? 'Tenant'}</td>
                <td className="numeric">{formatMoney(menu.price)}</td>
                <td className="numeric">{menu.stock} porsi</td>
                <td><Badge tone={menu.stock > 0 && menu.is_available ? 'success' : 'neutral'}>{menu.stock === 0 ? 'Habis' : menu.is_available ? 'Tersedia' : 'Dijeda'}</Badge></td>
                <td><div className="row wrap">
                  <Button size="sm" variant="outline" disabled={busy || !!tenant?.archived_at} onClick={() => open('stock', menu)}>Isi stok</Button>
                  <Button size="sm" variant="ghost" disabled={busy || !!tenant?.archived_at} onClick={() => open('edit', menu)}>Edit</Button>
                  <Button size="sm" variant="ghost" disabled={busy || !!tenant?.archived_at} onClick={() => open('delete', menu)}>Nonaktifkan</Button>
                </div></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        {!state.loading && !state.error && !menus.length && <p>Belum ada menu yang cocok.</p>}
      </section>
    </div>
    <Modal open={mode !== null} onOpenChange={open => { if (!busy && !open) setMode(null); }}
      title={mode === 'stock' ? 'Isi stok' : mode === 'delete' ? 'Nonaktifkan menu?' : mode === 'edit' ? 'Edit menu' : 'Tambah menu'}
      description={selected?.name ?? 'Pilih tenant dan isi menu baru.'}>
      <form className="stack" onSubmit={submit}>
        {mode === 'delete' ? <p>Menu tidak ditawarkan lagi. Riwayat pesanan tetap tersimpan.</p> : mode === 'stock' ? <>
          <p className="small muted">Isi jumlah porsi yang tersedia sekarang. Stok 0 berarti habis.</p>
          <Field label="Stok tersedia (porsi)"><input className="input" type="number" required min={0} max={1000000} step={1} value={stock} onChange={event => setStock(event.target.value)} /></Field>
        </> : <>
          <Field label="Tenant">
            <select className="select" required disabled={mode === 'edit' || actor?.role === 'tenant' || !!fixedTenantId}
              value={tenantId} onChange={event => {
                setTenantId(event.target.value);
                setCategory(DEFAULT_MENU_CATEGORIES[0]);
                setCustomCategory(false);
              }}>
              {tenantOptions.map(tenant => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
            </select>
          </Field>
          <Field label="Nama menu"><input className="input" required minLength={2} maxLength={100} value={name} onChange={event => setName(event.target.value)} /></Field>
          <div className="form-grid">
            <Field label="Harga (Rp)" hint={priceResult.success ? formatMoney(priceResult.data) : 'Contoh 20000 atau 20.000'}>
              <input className="input" type="text" inputMode="numeric" required value={price} onChange={event => setPrice(event.target.value)} />
            </Field>
            <Field label="Kategori">
              <select className="select" value={customCategory ? '' : menuCategoryKey(category)} onChange={event => {
                const selectedCategory = tenantCategories.get(event.target.value);
                setCategory(selectedCategory ?? '');
                setCustomCategory(selectedCategory === undefined);
              }}>
                {[...tenantCategories].map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                <option value="">Tambah kategori…</option>
              </select>
            </Field>
          </div>
          {customCategory && <Field label="Nama kategori baru">
            <input className="input" required maxLength={MAX_MENU_CATEGORY_LENGTH} placeholder="Misalnya Ayam atau Dessert"
              value={category} onChange={event => setCategory(event.target.value)} />
          </Field>}
          {mode === 'new' && <Field label="Stok awal (porsi)"><input className="input" type="number" required min={0} max={1000000} step={1} value={stock} onChange={event => setStock(event.target.value)} /></Field>}
          <ImageField label="Foto menu" file={photo} current={selected?.photo_url ?? null} onChange={setPhoto} disabled={busy} />
          <Field label="Deskripsi"><textarea className="textarea" maxLength={250} value={description} onChange={event => setDescription(event.target.value)} /></Field>
          <label className="row"><input type="checkbox" checked={available} disabled={mode === 'edit' && selected?.stock === 0} onChange={event => setAvailable(event.target.checked)} />Tersedia untuk dipesan</label>
        </>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions">
          <Button variant="outline" disabled={busy} onClick={() => setMode(null)}>Batal</Button>
          <Button type="submit" loading={busy}>{mode === 'delete' ? 'Nonaktifkan' : 'Simpan'}</Button>
        </div>
      </form>
    </Modal>
  </>;
}
