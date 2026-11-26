'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Badge, Button, EmptyState, FoodPhoto, Modal, Plus, Search, ChevronLeft, Store, formatMoney } from '@kantin/ui';
import { useDemo, type DemoMenu } from '@kantin/ui/demo';
import { Cart, Quantity } from './cart';

function unavailableLabel(menu: DemoMenu) {
  return menu.stock && menu.stock > 0 ? 'Tidak tersedia' : 'Habis';
}

export function TenantMenu({ tenantId }: { tenantId:string }) {
  const { menus, tenants, cart, changeQuantity } = useDemo();
  const [query,setQuery] = useState('');
  const [category,setCategory] = useState('Semua');
  const [detailId,setDetailId] = useState<string|null>(null);
  const tenant = tenants.find(item => item.id === tenantId && item.is_active);
  const items = menus.filter(menu => menu.tenant_id === tenant?.id && menu.is_active);
  const detail = items.find(menu => menu.id === detailId);
  const filtered = items.filter(menu => (category === 'Semua' || menu.category === category)
    && menu.name.toLocaleLowerCase('id').includes(query.toLocaleLowerCase('id')));

  if (!tenant) return <section className="panel">
    <EmptyState icon={<Store />} title="Tenant tidak tersedia" description="Tenant belum aktif atau sedang tutup."
      action={<Button asChild><Link href="/">Pilih tenant lain</Link></Button>} />
  </section>;

  return <>
    <Link href="/" className="back-link"><ChevronLeft />Pilih tenant lain</Link>
    <div className="catalog-title"><div><p className="small muted">Kantin Vokasi UI</p><h1>{tenant.name}</h1><p>{tenant.description}</p></div></div>
    <div className="catalog-layout">
      <section>
        <div className="search-field catalog-search"><Search /><input className="input" aria-label="Cari menu"
          placeholder="Cari menu" value={query} onChange={event => setQuery(event.target.value)} /></div>
        <div className="menu-categories">{['Semua','Makanan','Minuman','Camilan'].map(value =>
          <button key={value} className={value === category ? 'active' : ''} onClick={() => setCategory(value)}>{value}</button>,
        )}</div>
        <div className="menu-list-heading"><h2>Menu</h2><span className="small muted">{filtered.length} pilihan</span></div>
        {filtered.length ? <div className="menu-list">{filtered.map((menu,index) =>
          <article className={'menu-row ' + (!menu.is_available ? 'unavailable' : '')} key={menu.id}>
            <button className="product-open" aria-label={'Lihat detail ' + menu.name} onClick={() => setDetailId(menu.id)}>
              <span className="product-picture"><FoodPhoto src={menu.image} alt={menu.name} />
                <span className="menu-number">{String(index+1).padStart(2,'0')}</span>
              </span>
              <span className="product-copy"><strong>{menu.name}</strong><small>{menu.description}</small>
                {menu.is_available && menu.stock !== undefined && <small>{menu.stock} porsi tersedia</small>}
              </span>
            </button>
            <div className="menu-row-action"><strong className="menu-price numeric">{formatMoney(menu.price)}</strong>
              {!menu.is_available ? <span className="sold-out">{unavailableLabel(menu)}</span>
                : (cart[menu.id] ?? 0) > 0 ? <Quantity id={menu.id} name={menu.name} />
                : <Button size="sm" variant="outline" onClick={() => changeQuantity(menu.id,1)}><Plus />Tambah</Button>}
            </div>
          </article>,
        )}</div> : <section className="panel"><p>Tidak ada menu yang cocok.</p></section>}
      </section>
      <Cart />
    </div>
    <Modal open={detailId !== null} onOpenChange={open => { if (!open) setDetailId(null); }}
      title={detail?.name ?? 'Detail menu'} description={detail?.category ?? 'Menu belum tersedia'}>
      {detail ? <div className="stack">
        <div className="product-detail-photo"><FoodPhoto src={detail.image} alt={detail.name} /></div>
        <p>{detail.description}</p>
        <div className="row between"><strong>{formatMoney(detail.price)}</strong>
          <Badge>{detail.is_available ? (detail.stock ?? '—') + ' porsi' : unavailableLabel(detail)}</Badge>
        </div>
        <Button disabled={!detail.is_available || (cart[detail.id] ?? 0) >= Math.min(99,detail.stock ?? 99)}
          onClick={() => { changeQuantity(detail.id,1); setDetailId(null); }}>Tambah ke keranjang</Button>
      </div> : <p>Menu ini sudah tidak ada di katalog.</p>}
    </Modal>
  </>;
}
