'use client';
import { useState } from 'react';
import { Badge, Button, EmptyState, FoodPhoto, Modal, Plus, Search, formatMoney } from '@kantin/ui';
import { useDemo, type DemoMenu } from '@kantin/ui/demo';
import { Cart, Quantity } from '../components/cart';

const categories = ['Semua menu', 'Makanan', 'Minuman', 'Camilan'];
export default function CatalogPage() {
  const { menus, tenants, cart, changeQuantity } = useDemo();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Semua menu');
  const [sort, setSort] = useState('popular');
  const [selectedTenant, setSelectedTenant] = useState(tenants[0]?.id ?? '');
  const [detail, setDetail] = useState<DemoMenu | null>(null);
  const activeTenants = tenants.filter((tenant) => tenant.is_active);
  const tenant = activeTenants.find((entry) => entry.id === selectedTenant) ?? activeTenants[0];
  const tenantMenus = menus.filter((item) => item.is_active && item.tenant_id === tenant?.id);
  const filtered = tenantMenus.filter((item) => (category === 'Semua menu' || item.category === category) && item.name.toLocaleLowerCase('id').includes(query.toLocaleLowerCase('id')))
    .sort((a,b) => sort === 'lowest' ? a.price-b.price : sort === 'highest' ? b.price-a.price : Number(b.popular)-Number(a.popular));
  return <>
    <div className="catalog-title"><div><p className="small muted">Kantin Vokasi UI</p><h1>{tenant?.name ?? 'Belum ada tenant aktif'}</h1></div></div>
    <div className="catalog-layout"><section aria-labelledby="catalog-heading">
      {activeTenants.length > 1 ? <div className="categories" aria-label="Pilih tenant">{activeTenants.map((entry) => <button key={entry.id} className={'category ' + (entry.id === tenant?.id ? 'active' : '')} aria-pressed={entry.id === tenant?.id} onClick={() => setSelectedTenant(entry.id)}>{entry.name}</button>)}</div> : null}
      <div className="search-field catalog-search"><Search /><input className="input" aria-label="Cari menu" placeholder="Cari makanan atau minuman" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
      <div className="menu-categories" aria-label="Kategori menu">{categories.map((entry) => <button key={entry} className={category === entry ? 'active' : ''} aria-pressed={category === entry} onClick={() => setCategory(entry)}>{entry === 'Semua menu' ? 'Semua' : entry}<span>{tenantMenus.filter(item => entry === 'Semua menu' || item.category === entry).length}</span></button>)}</div>
      <div className="menu-list-heading"><h2 id="catalog-heading">{category === 'Semua menu' ? 'Pilihan menu' : category}</h2><select aria-label="Urutkan menu" className="sort-select" value={sort} onChange={(event) => setSort(event.target.value)}><option value="popular">Pilihan tenant</option><option value="lowest">Harga terendah</option><option value="highest">Harga tertinggi</option></select></div>
      {filtered.length ? <div className="menu-list">{filtered.map((item,index) => <article key={item.id} className={'menu-row ' + (!item.is_available ? 'unavailable' : '')}>
        <button className="product-open" aria-label={'Lihat detail ' + item.name} onClick={() => setDetail(item)}><span className="product-picture"><FoodPhoto src={item.image} alt={item.name} /><span className="menu-number">{String(index+1).padStart(2,'0')}</span></span><span className="product-copy"><strong>{item.name}</strong><small>{item.description}</small></span></button>
        <div className="menu-row-action"><span className="menu-price numeric">{formatMoney(item.price)}</span>{!item.is_available ? <span className="sold-out">Habis</span> : (cart[item.id] ?? 0) > 0 ? <Quantity id={item.id} name={item.name} /> : <Button variant="outline" size="sm" className="menu-add" aria-label={'Tambah ' + item.name} onClick={() => changeQuantity(item.id,1)}><Plus />Tambah</Button>}</div>
      </article>)}</div> : <div className="panel"><EmptyState icon={<Search />} title={tenant ? 'Menu tidak ditemukan' : 'Tenant belum membuka pesanan'} description="Coba nama menu lain atau pilih semua kategori." action={<Button variant="outline" onClick={() => {setQuery('');setCategory('Semua menu');}}>Semua menu</Button>} /></div>}
    </section><Cart /></div>
    <Modal open={!!detail} onOpenChange={(open) => {if(!open)setDetail(null);}} title={detail?.name ?? 'Detail menu'} description={detail?.category ?? 'Detail menu'}>
      {detail ? <div className="stack"><div className="product-detail-photo"><FoodPhoto src={detail.image} alt={detail.name} /></div><p>{detail.description}</p><div className="row between"><strong className="menu-price numeric">{formatMoney(detail.price)}</strong>{(cart[detail.id] ?? 0)>0 ? <Quantity id={detail.id} name={detail.name} /> : <Badge>{detail.category}</Badge>}</div><Button className="full" disabled={!detail.is_available} onClick={() => {changeQuantity(detail.id,1);setDetail(null);}}>{detail.is_available ? 'Tambah ke keranjang' : 'Menu sedang habis'}<Plus /></Button></div> : null}
    </Modal>
  </>;
}
