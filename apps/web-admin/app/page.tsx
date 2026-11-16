'use client';
import Link from 'next/link';
import { ArrowRight, Badge, Button, FoodPhoto, formatMoney } from '@kantin/ui';
import { useDemo } from '@kantin/ui/demo';
import { OrderTable } from '../components/order-table';

export default function DashboardPage() {
  const { orders, menus } = useDemo();
  const pending = orders.filter(({ order }) => order.status === 'menunggu_konfirmasi');
  const cooking = orders.filter(({ order }) => order.status === 'diproses');
  const ready = orders.filter(({ order }) => order.status === 'siap');
  const income = orders.filter(({ order }) => order.payment_status === 'paid').reduce((sum, entry) => sum + entry.order.total, 0);
  return <>
    <div className="page-intro"><div><h1>Ringkasan kantin</h1><p>Pembayaran dan pesanan yang perlu ditindaklanjuti.</p></div><Button asChild variant="outline"><Link href="/pesanan">Semua pesanan<ArrowRight /></Link></Button></div>
    <div className="operations-summary">
      <div><span>Perlu konfirmasi</span><strong className="numeric">{pending.length.toString().padStart(2,'0')}</strong><small>Periksa pembayaran QRIS</small></div>
      <div><span>Sedang diproses</span><strong className="numeric">{cooking.length.toString().padStart(2,'0')}</strong><small>Pesanan di dapur</small></div>
      <div><span>Siap diambil</span><strong className="numeric">{ready.length.toString().padStart(2,'0')}</strong><small>Menunggu pelanggan</small></div>
      <div><span>Pembayaran diterima</span><strong className="numeric revenue-value">{formatMoney(income)}</strong></div>
    </div>
    <section className="panel priority-panel"><div className="panel-header"><div><h2>Konfirmasi pembayaran</h2><p className="small muted">Cocokkan nominal dan merchant sebelum menerima.</p></div><Badge tone="warning">{pending.length} menunggu</Badge></div><OrderTable entries={pending} /></section>
    <div className="dashboard-grid"><section className="panel"><div className="panel-header"><div><h2>Pesanan berjalan</h2></div></div><OrderTable entries={[...cooking,...ready]} /></section>
      <section className="panel"><div className="panel-header"><div><h2>Menu tenant</h2></div></div><div className="popular-list">{menus.filter(menu=>menu.is_active).slice(0,4).map(menu=><div className="popular-line" key={menu.id}><FoodPhoto src={menu.image} alt={menu.name} /><div><h3>{menu.name}</h3><p>{formatMoney(menu.price)}</p></div><span className={'availability-label '+(!menu.is_available?'muted':'text-success')}>{menu.is_available?'Tersedia':'Habis'}</span></div>)}</div><Link href="/menu" className="link-action catalog-management-link">Kelola menu<ArrowRight /></Link></section></div>
  </>;
}
