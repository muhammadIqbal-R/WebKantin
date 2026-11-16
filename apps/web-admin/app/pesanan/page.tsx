'use client';
import { useState } from 'react';
import { Badge, ClipboardList, Search } from '@kantin/ui';
import { useDemo } from '@kantin/ui/demo';
import { OrderTable } from '../../components/order-table';
export default function OrdersPage() {
  const { orders } = useDemo();
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const entries = orders.filter(({ order }) => (filter === 'all' || order.status === filter) &&
    (order.customer_name + order.order_code).toLocaleLowerCase('id').includes(query.toLocaleLowerCase('id')));
  return <><div className="page-intro"><div><div className="eyebrow text-action">ANTREAN PESANAN</div><h1 style={{ marginTop: 'var(--s2)' }}>Kelola pesanan</h1><p>Periksa pembayaran, siapkan pesanan, dan kabari saat siap.</p></div><Badge><ClipboardList />{orders.length} pesanan contoh</Badge></div>
    <section className="panel"><div className="filters"><div className="filter-tabs" aria-label="Filter status pesanan">
      {[['all','Semua'],['menunggu_konfirmasi','Perlu konfirmasi'],['diproses','Diproses'],['siap','Siap'],['selesai','Selesai']].map(([value,label]) => <button key={value} className={filter === value ? 'active' : ''} aria-pressed={filter === value} onClick={() => setFilter(value!)}>{label}</button>)}</div>
      <div className="search-field"><Search /><input className="input" placeholder="Cari nama atau kode pesanan" aria-label="Cari pesanan" value={query} onChange={(event) => setQuery(event.target.value)} /></div></div>
      <OrderTable entries={entries} /><div className="table-bottom"><span>{entries.length} pesanan ditampilkan</span><span>Seluruh tindakan adalah simulasi frontend</span></div>
    </section></>;
}
