'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { STATUS_LABELS, STATUS_TONES } from '@kantin/ui/demo';
import { Badge, Button, Modal, OrderChat, formatMoney } from '@kantin/ui';
import type { Order } from '@kantin/shared';
import { useCustomerOrders } from '../../components/customer-orders';
import { useCustomerAuth } from '../../components/customer-auth';

export default function OrdersPage() {
  const auth = useCustomerAuth();
  const state = useCustomerOrders();
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState('');
  const [chatOrder, setChatOrder] = useState<{id:string;code:string} | null>(null);

  if (auth.loading) return <p role="status">Memeriksa sesi…</p>;
  if (!auth.user) return <section className="panel stack">
    <h1>Pesananmu</h1><p>Masuk untuk melihat pesanan akun Anda.</p>
    <Button asChild><Link href="/masuk">Masuk</Link></Button>
  </section>;

  async function paid(order: Order) {
    if (busy) return;
    setBusy(order.id);
    setActionError('');
    try { await state.paid(order); }
    catch (error) {
      setActionError(error instanceof Error ? error.message : 'Klaim belum dapat dikirim.');
    } finally { setBusy(''); }
  }

  return <>
    <div className="page-intro">
      <h1>Pesananmu</h1>
      <Button variant="outline" onClick={() => void state.reload()}>Muat ulang</Button>
    </div>
    {state.loading && <p role="status">Memuat pesanan…</p>}
    {state.error && <p role="alert" className="form-error">{state.error}</p>}
    {actionError && <p role="alert" className="form-error">{actionError}</p>}
    <div className="order-cards">
      {state.orders.map(({ data: order, items, payment_rejection_reason, chat_available }) => <article className="panel order-card stack" key={order.id}>
        <div className="panel-header">
          <strong className="order-code">{order.order_code}</strong>
          <Badge tone={STATUS_TONES[order.status]}>{STATUS_LABELS[order.status]}</Badge>
        </div>
        <p>{order.order_type === 'dine_in' ? 'Makan di tempat' : 'Bawa pulang'} · {order.customer_name}</p>
        <div className="order-item-list">{items.map(item => <div className="row between" key={item.id}>
          <span>{item.qty} × {item.menu_name}</span><span>{formatMoney(item.subtotal)}</span>
        </div>)}</div>
        <div className="row between"><strong>Total</strong><strong>{formatMoney(order.total)}</strong></div>
        {order.status === 'menunggu_bayar' ? <>
          {order.payment_status === 'rejected' && <div className="notice stack">
            <strong>Klaim pembayaran ditolak</strong>
            {payment_rejection_reason && <p>{payment_rejection_reason}</p>}
            <p className="small">Periksa riwayat transaksi sebelum membayar atau mengirim klaim kembali.</p>
          </div>}
          <Payment id={order.id} />
          <Button loading={busy === order.id} disabled={!!busy} onClick={() => void paid(order)}>
            {order.payment_status === 'rejected' ? 'Kirim ulang klaim pembayaran' : 'Saya sudah bayar'}
          </Button>
        </> : <p className="notice small">{statusDescription(order.status)}</p>}
        {chat_available && <Button variant="outline" size="sm"
          onClick={() => setChatOrder({id:order.id,code:order.order_code})}>Chat tenant</Button>}
      </article>)}
    </div>
    <Modal open={chatOrder !== null} onOpenChange={open => { if (!open) setChatOrder(null); }}
      title="Chat dengan tenant" description={chatOrder?.code ?? ''}>
      {chatOrder && <OrderChat key={chatOrder.id} request={state.request}
        path={'/api/orders/' + chatOrder.id + '/messages'} side="pelanggan" />}
    </Modal>
    {!state.loading && !state.error && !state.orders.length && <section className="panel stack">
      <p>Belum ada pesanan pada akun ini.</p>
      <Button asChild><Link href="/">Pilih tenant</Link></Button>
    </section>}
    {state.next && <Button variant="outline" onClick={() => {
      setActionError('');
      void state.older().catch(() => setActionError('Riwayat belum dapat dimuat.'));
    }}>Lihat pesanan lebih lama</Button>}
  </>;
}

function statusDescription(status: Order['status']) {
  switch (status) {
    case 'menunggu_konfirmasi': return 'Tenant sedang memeriksa pembayaran.';
    case 'diproses': return 'Pesanan sedang disiapkan.';
    case 'siap': return 'Pesanan siap diambil.';
    case 'selesai': return 'Pesanan selesai.';
    case 'dibatalkan': return 'Pesanan dibatalkan.';
    case 'menunggu_bayar': return 'Menunggu pembayaran.';
  }
}

function Payment({ id }: { id: string }) {
  const { payment } = useCustomerOrders();
  const [data, setData] = useState<Awaited<ReturnType<typeof payment>> | null>(null);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    void payment(id).then(value => { if (active) setData(value); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [payment, id, revision]);

  return <div className="stack">
    {failed ? <>
      <p role="alert">QRIS belum dapat dimuat.</p>
      <Button size="sm" variant="outline" onClick={() => {
        setFailed(false);
        setData(null);
        setRevision(value => value + 1);
      }}>Muat ulang QRIS</Button>
    </> : data ? <>
      {/* The signed image can expire. Keep the retry available on image failure. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={data.qris.image_url} alt="QRIS pembayaran tenant" width="280" height="280"
        className="food-photo upload-preview" onError={() => setFailed(true)} />
      <strong>{data.qris.merchant_name}</strong>
      <p className="small">Bayar tepat {formatMoney(data.total)} ke merchant di atas.</p>
    </> : <p role="status">Memuat QRIS…</p>}
  </div>;
}
