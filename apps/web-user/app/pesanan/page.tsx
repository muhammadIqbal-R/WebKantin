'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { STATUS_LABELS, STATUS_TONES } from '@kantin/ui/demo';
import { Badge, Button, Field, FulfillmentDetails, Modal, OrderChat, OrderRefundPanel, formatMoney } from '@kantin/ui';
import { UploadMetadataSchema } from '@kantin/shared';
import type { Order, OrderDetailResponseSchema } from '@kantin/shared';
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

  async function paid(order: Order, file: File) {
    if (busy) return;
    setBusy(order.id);
    setActionError('');
    try { await state.paid(order,file); }
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
      {state.orders.map(({ data: order, items, payment_rejection_reason, chat_available, payment_window, refund, refund_available, fulfillment }) => <article className="panel order-card stack" key={order.id}>
        <div className="panel-header">
          <strong className="order-code">{order.order_code}</strong>
          {refund?.status==='dikembalikan' ? <Badge tone="success">Dana dikembalikan</Badge>
            : refund?.status==='diproses' ? <Badge tone="neutral">Refund diproses</Badge>
            : <Badge tone={STATUS_TONES[order.status]}>{STATUS_LABELS[order.status]}</Badge>}
        </div>
        <p>{order.order_type === 'dine_in' ? 'Makan di tempat' : 'Bawa pulang'} · {order.customer_name}</p>
        <FulfillmentDetails details={fulfillment} />
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
          <AwaitingPayment order={order} window={payment_window ?? null} busy={busy}
            onPaid={file => void paid(order,file)} />
        </> : refund?.status!=='diproses' && refund?.status!=='dikembalikan'
          && <p className="notice small">{statusDescription(order.status)}</p>}
        {payment_window?.expired_at && <p className="small">Tenggat pembayaran lewat dan stok sudah dilepas. Jika sudah transfer, ajukan refund di bawah.</p>}
        <OrderRefundPanel refund={refund ?? null} available={refund_available ?? false} amount={order.total}
          request={state.request} refresh={() => state.refreshOrder(order.id)} path={'/api/orders/' + order.id + '/refund'} />
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

function AwaitingPayment({ order, window: paymentWindow, busy, onPaid }: {
  order:Order;
  window:NonNullable<ReturnType<typeof OrderDetailResponseSchema.parse>['payment_window']> | null;
  busy:string;
  onPaid:(file:File)=>void;
}) {
  const deadline = order.payment_status==='unpaid' ? paymentWindow?.deadline_at : null;
  const [due, setDue] = useState(false);
  const [file,setFile] = useState<File|null>(null);
  const [fileError,setFileError] = useState('');
  useEffect(()=>{
    if (!deadline) return;
    const timer=setTimeout(()=>setDue(true),Math.max(0,Date.parse(deadline)-Date.now()));
    return ()=>clearTimeout(timer);
  },[deadline]);
  if (deadline && due) return <p className="notice small">Tenggat pembayaran lewat. Tunggu status diperbarui sebelum melanjutkan.</p>;
  return <>
    {deadline && <p className="small">Bayar dan kirim bukti sebelum {
      new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Jakarta'}).format(new Date(deadline))
    } WIB.</p>}
    <Payment id={order.id} />
    <Field label="Tangkapan layar bukti bayar" hint="JPG, PNG, atau WebP · maksimal 2 MiB">
      <input className="input" type="file" accept="image/jpeg,image/png,image/webp" disabled={!!busy}
        onChange={event=>{
          const selected=event.target.files?.[0]??null;
          if(selected&&!UploadMetadataSchema.safeParse({mime_type:selected.type,size_bytes:selected.size}).success){
            setFile(null);
            setFileError('Pilih JPG, PNG, atau WebP maksimal 2 MiB.');
            event.target.value='';
            return;
          }
          setFileError('');
          setFile(selected);
        }} />
    </Field>
    {fileError&&<p className="form-error" role="alert">{fileError}</p>}
    <Button loading={busy===order.id} disabled={!!busy||!file} onClick={()=>{if(file)onPaid(file);}}>
      {order.payment_status==='rejected' ? 'Kirim ulang bukti pembayaran' : 'Kirim bukti pembayaran'}
    </Button>
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
