'use client';
import {useCallback,useEffect,useState} from 'react';
import {AdminOrderListResponseSchema,OrderDetailResponseSchema,OrderResponseSchema,PaymentProofResponseSchema,type Order} from '@kantin/shared';
import {Badge,Button,Field,FulfillmentDetails,Modal,OrderChat,OrderRefundPanel,formatMoney} from '@kantin/ui';
import {STATUS_LABELS,STATUS_TONES} from '@kantin/ui/demo';
import {useLoad,useManagement} from './management';
import {DataState} from './data-state';
export function OrderWorkspace(){
 const {request,actor}=useManagement();
 const tenant=actor?.role==='tenant';
 const [status,setStatus]=useState(''),[query,setQuery]=useState(''),[cursor,setCursor]=useState(''),[refundOnly,setRefundOnly]=useState(false),[selected,setSelected]=useState<Order|null>(null);
 const load=useCallback(()=>request('/api/admin/orders?limit=50'+(status?'&status='+status:'')+(cursor?'&cursor='+cursor:'')+(refundOnly?'&refund_pending=true':''),AdminOrderListResponseSchema),[request,status,cursor,refundOnly]);const state=useLoad(load);
 const reload=state.reload;
 useEffect(()=>{const refresh=()=>void reload();const timer=setInterval(refresh,5000);window.addEventListener('kantin-order-update',refresh);return()=>{clearInterval(timer);window.removeEventListener('kantin-order-update',refresh);};},[reload]);
 const rows=state.data?.data.filter(order=>(order.order_code+' '+order.customer_name).toLocaleLowerCase('id').includes(query.toLocaleLowerCase('id')))??[];
 return <>
  <div className="page-intro">
    <h1>{tenant?'Pesanan masuk':'Pantau pesanan'}</h1>
    <Button variant="outline" onClick={()=>void reload()}>Muat ulang</Button>
  </div>
  <section className="panel stack">
    <div className="filters">
      <select className="select" aria-label="Filter status" value={status}
        onChange={event=>{setStatus(event.target.value);setCursor('');}}>
        <option value="">Semua status</option>
        {Object.entries(STATUS_LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}
      </select>
      <input className="input" placeholder="Cari kode atau nama" aria-label="Cari pesanan"
        value={query} onChange={event=>setQuery(event.target.value)} />
    </div>
    <label className="row"><input type="checkbox" checked={refundOnly}
      onChange={event=>{setRefundOnly(event.target.checked);setCursor('');if(event.target.checked)setStatus('');}} />
      Refund perlu ditangani
    </label>
    <DataState {...state} retry={reload} />
    <div className="table-wrap" tabIndex={0} aria-label="Daftar pesanan">
      <table className="data-table">
        <thead><tr><th>Pesanan</th><th>Pemesan</th><th>Total</th><th>Status</th><th>Aksi</th></tr></thead>
        <tbody>{rows.map(order=><tr key={order.id}>
          <td><strong>{order.order_code}</strong><p className="small muted">{new Date(order.created_at).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})}</p></td>
          <td>{order.customer_name}</td>
          <td className="numeric">{formatMoney(order.total)}</td>
          <td><Badge tone={STATUS_TONES[order.status]}>{STATUS_LABELS[order.status]}</Badge>
            {order.refund_status&&<p className="small">Refund {order.refund_status}</p>}
          </td>
          <td><Button size="sm" variant="outline" onClick={()=>setSelected(order)}>
            {tenant&&order.status==='menunggu_konfirmasi'?'Periksa pembayaran':'Detail'}
          </Button></td>
        </tr>)}</tbody>
      </table>
    </div>
    {!state.loading&&!state.error&&!rows.length&&<p>Belum ada pesanan yang cocok.</p>}
    <div className="row between">
      <Button variant="outline" disabled={!cursor} onClick={()=>setCursor('')}>Terbaru</Button>
      <Button variant="outline" disabled={!state.data?.next_cursor} onClick={()=>setCursor(state.data?.next_cursor??'')}>Lebih lama</Button>
    </div>
  </section>
  <Modal open={!!selected} onOpenChange={open=>{if(!open)setSelected(null);}} title="Detail pesanan"
    description={selected?.order_code??''}>
    {selected&&<OrderDetail key={selected.id} id={selected.id} onRefundChanged={reload} done={async()=>{setSelected(null);await reload();}} />}
  </Modal>
 </>;
}
const confirmationText = {
  accept: 'Terima pembayaran dan mulai siapkan pesanan?',
  reject: 'Tolak klaim pembayaran?',
  siap: 'Tandai pesanan siap diambil?',
  selesai: 'Tandai pesanan selesai?',
  dibatalkan: 'Batalkan pesanan dan kembalikan stok?',
};

function OrderDetail({ id, done, onRefundChanged }: { id: string; done: () => Promise<void>; onRefundChanged: () => Promise<void> }) {
  const { actor, request } = useManagement();
  const load = useCallback(() => request('/api/admin/orders/' + id, OrderDetailResponseSchema), [request, id]);
  const state = useLoad(load);
  const order = state.data?.data;
  const merchant = state.data?.payment_merchant_name;
  const refund = state.data?.refund ?? null;
  const stopFulfillment = refund?.status === 'diproses' || refund?.status === 'dikembalikan';
  const [reason, setReason] = useState('');
  const [action, setAction] = useState<keyof typeof confirmationText | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const tenant = actor?.role === 'tenant';

  async function submit() {
    if (!tenant || !order || !action || busy || (action === 'accept' && !merchant)) return;
    const reasonText = reason.trim();
    if (action === 'reject' && reasonText.length < 2) {
      setError('Isi alasan penolakan minimal 2 karakter.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const base = '/api/admin/orders/' + id;
      const version = { expected_version: order.version };
      if (action === 'accept' || action === 'reject') {
        await request(base + '/confirm-payment', OrderResponseSchema, 'PATCH', {
          ...version, decision: action, ...(action === 'reject' ? { reason: reasonText } : {}),
        });
      } else {
        await request(base + '/status', OrderResponseSchema, 'PATCH', { ...version, status: action });
      }
      await done();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Perubahan belum dapat disimpan.');
    } finally { setBusy(false); }
  }

  return <div className="stack">
    <DataState {...state} retry={state.reload} />
    {order && <>
      <div className="row between">
        <strong>{order.customer_name}</strong>
        <Badge tone={STATUS_TONES[order.status]}>{STATUS_LABELS[order.status]}</Badge>
      </div>
      <p className="small">{order.order_type === 'dine_in' ? 'Makan di tempat' : 'Bawa pulang'}</p>
      <FulfillmentDetails details={state.data?.fulfillment} />
      {state.data?.items.map(item => <div className="row between" key={item.id}>
        <span>{item.qty} × {item.menu_name}</span><span>{formatMoney(item.subtotal)}</span>
      </div>)}
      <div className="row between"><strong>Total</strong><strong>{formatMoney(order.total)}</strong></div>
      <p>Merchant QRIS: {merchant ?? 'Belum dapat dimuat'}</p>
      {tenant && order.payment_status!=='unpaid' && <PaymentProof key={order.version} id={id} />}
      {tenant && order.status === 'menunggu_konfirmasi' && <p className="notice small">
        Cocokkan bukti dengan nominal, merchant, dan mutasi pembayaran sebelum menerima.
      </p>}
      {tenant && (action ? <>
        <p>{confirmationText[action]}</p>
        {action === 'reject' && <Field label="Alasan penolakan" hint="Alasan ini terlihat oleh pelanggan.">
          <textarea className="textarea" required minLength={2} maxLength={300} disabled={busy}
            value={reason} onChange={event => setReason(event.target.value)} />
        </Field>}
        <div className="form-actions">
          <Button variant="outline" disabled={busy} onClick={() => { setAction(null); setError(''); }}>Kembali</Button>
          <Button loading={busy} disabled={action === 'accept' && !merchant} onClick={() => void submit()}>
            Ya, konfirmasi
          </Button>
        </div>
      </> : <div className="form-actions">
        {order.status === 'menunggu_konfirmasi' && <>
          <Button disabled={!merchant} onClick={() => setAction('accept')}>Terima pembayaran</Button>
          <Button variant="danger" onClick={() => setAction('reject')}>Tolak</Button>
        </>}
        {order.status === 'diproses' && !stopFulfillment && <Button onClick={() => setAction('siap')}>Tandai siap</Button>}
        {order.status === 'siap' && !stopFulfillment && <Button onClick={() => setAction('selesai')}>Selesai</Button>}
        {(order.status === 'menunggu_bayar' || order.status === 'menunggu_konfirmasi') &&
          <Button variant="outline" onClick={() => setAction('dibatalkan')}>Batalkan pesanan</Button>}
      </div>)}
    </>}
    {error && <div className="stack">
      <p className="form-error" role="alert">{error}</p>
      <Button variant="outline" onClick={() => { setAction(null); setError(''); void state.reload(); }}>
        Muat ulang detail
      </Button>
    </div>}
    {order && <OrderRefundPanel refund={refund} available={false} amount={order.total} staff
      path={'/api/admin/orders/' + id + '/refund'} request={request} refresh={async()=>{await Promise.all([state.reload(),onRefundChanged()]);}} />}
    {actor?.role === 'tenant' && state.data?.chat_available && <>
      <Button variant="outline" size="sm" aria-expanded={chatOpen}
        onClick={() => setChatOpen(open => !open)}>{chatOpen ? 'Tutup chat' : 'Chat pelanggan'}</Button>
      {chatOpen && <OrderChat request={request} side="tenant" path={'/api/admin/orders/' + id + '/messages'} />}
    </>}
  </div>;
}

function PaymentProof({id}:{id:string}) {
  const {request}=useManagement();
  const [url,setUrl]=useState<string|null|undefined>(undefined);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');

  async function show() {
    setBusy(true);
    setError('');
    try {
      const proof=await request('/api/admin/orders/'+id+'/payment-proof',PaymentProofResponseSchema);
      setUrl(proof.image_url);
    } catch (failure) {
      setUrl(undefined);
      setError(failure instanceof Error?failure.message:'Bukti pembayaran belum dapat dimuat.');
    } finally {setBusy(false);}
  }

  return <div className="stack">
    {typeof url==='string'&&<>
      <img className="payment-proof-image" src={url} alt="Tangkapan layar bukti pembayaran"
        referrerPolicy="no-referrer" onError={()=>{setUrl(undefined);setError('Bukti belum dapat dimuat. Coba buka kembali.');}} />
      <a className="link-action" href={url} target="_blank" rel="noreferrer">Buka ukuran penuh</a>
    </>}
    {url===null&&<p className="small muted">Pesanan ini belum memiliki gambar bukti pembayaran.</p>}
    {error&&<p className="form-error" role="alert">{error}</p>}
    {url===undefined&&<Button variant="outline" size="sm" loading={busy} onClick={()=>void show()}>
      {error?'Muat ulang bukti':'Lihat bukti pembayaran'}
    </Button>}
  </div>;
}
