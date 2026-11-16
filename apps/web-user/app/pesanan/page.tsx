'use client';
import Link from 'next/link';
import { ArrowRight, Badge, Button, Check, Clock3, EmptyState, QrCode, ReceiptText, UtensilsCrossed, formatMoney } from '@kantin/ui';
import { STATUS_LABELS, STATUS_TONES, useDemo } from '@kantin/ui/demo';
const steps = ['Menunggu pembayaran', 'Konfirmasi tenant', 'Sedang disiapkan', 'Siap diambil', 'Selesai'];
export default function OrdersPage() {
  const { orders, tenants, reportPaid } = useDemo();
  return <>
    <div className="page-intro"><div><div className="eyebrow">STATUS PESANAN</div><h1>Pesananmu</h1><p>Detail pembayaran dan perkembangan pesanan ada di sini.</p></div><Badge><Clock3 />Pratinjau status</Badge></div>
    {orders.length ? <div className="order-cards">{orders.map(({ order, items }) => {
      const step = ['menunggu_bayar', 'menunggu_konfirmasi', 'diproses', 'siap', 'selesai'].indexOf(order.status);
      return <article className="panel order-card" key={order.id}>
        <div className="panel-header"><div><p className="order-code">{order.order_code}</p><h2 style={{ marginTop: 'var(--s2)' }}>{tenants.find((tenant) => tenant.id === order.tenant_id)?.name}</h2></div><Badge tone={STATUS_TONES[order.status]}>{STATUS_LABELS[order.status]}</Badge></div>
        <p className="row small muted"><UtensilsCrossed />{order.customer_name} · {order.order_type === 'dine_in' ? 'Makan di tempat' : 'Bawa pulang'}</p>
        <div className="order-item-list">{items.map((item) => <div className="row between small" key={item.id}><span>{item.qty} × {item.menu_name}</span><span>{formatMoney(item.subtotal)}</span></div>)}
          <div className="row between" style={{ marginTop: 'var(--s2)' }}><strong>Total pesanan</strong><strong>{formatMoney(order.total)}</strong></div></div>
        {order.status === 'menunggu_bayar' ? <><div className="qris-placeholder"><QrCode /><strong>Tempat QRIS tenant</strong><p>Gambar QRIS akan ditambahkan saat setup. Ini bukan kode pembayaran; jangan lakukan transfer.</p></div><Button className="full" onClick={() => reportPaid(order.id)}>Saya sudah bayar · simulasi<ArrowRight /></Button></> : <ol className="timeline" aria-label="Status pesanan">{steps.map((label, index) => <li key={label} className={index < step ? 'reached' : index === step ? 'current' : ''} aria-current={index === step ? 'step' : undefined}><span className="timeline-dot">{index < step ? <Check /> : index + 1}</span>{label}</li>)}</ol>}
        {order.status === 'menunggu_konfirmasi' ? <p className="notice small" style={{ marginTop: 'var(--s5)' }}>Klaim pembayaran contoh menunggu konfirmasi. Backend dan realtime belum dihubungkan.</p> : null}
      </article>;
    })}</div> : <div className="panel"><EmptyState icon={<ReceiptText />} title="Belum ada pesanan" description="Pesanan contoh yang dibuat dalam sesi ini akan ditampilkan di sini." action={<Button asChild><Link href="/">Pilih menu<ArrowRight /></Link></Button>} /></div>}
  </>;
}
