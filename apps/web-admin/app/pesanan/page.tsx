'use client';
import {useCallback,useEffect,useState} from 'react';
import {AdminOrderListResponseSchema,OrderDetailResponseSchema,OrderResponseSchema,type Order} from '@kantin/shared';
import {Badge,Button,Field,Modal,formatMoney} from '@kantin/ui';
import {STATUS_LABELS,STATUS_TONES} from '@kantin/ui/demo';
import {useLoad,useManagement} from '../../components/management';
import {DataState} from '../../components/data-state';
export default function OrdersPage(){
 const {request}=useManagement();const [status,setStatus]=useState(''),[query,setQuery]=useState(''),[cursor,setCursor]=useState(''),[selected,setSelected]=useState<Order|null>(null);
 const load=useCallback(()=>request('/api/admin/orders?limit=50'+(status?'&status='+status:'')+(cursor?'&cursor='+cursor:''),AdminOrderListResponseSchema),[request,status,cursor]);const state=useLoad(load);
 const reload=state.reload;
 useEffect(()=>{const refresh=()=>void reload();const timer=setInterval(refresh,5000);window.addEventListener('kantin-order-update',refresh);return()=>{clearInterval(timer);window.removeEventListener('kantin-order-update',refresh);};},[reload]);
 const rows=state.data?.data.filter(order=>(order.order_code+' '+order.customer_name).toLocaleLowerCase('id').includes(query.toLocaleLowerCase('id')))??[];
 return <><div className="page-intro"><div><h1>Pesanan</h1><p>Periksa pembayaran dan siapkan pesanan tenant.</p></div><Button variant="outline" onClick={()=>void state.reload()}>Muat ulang</Button></div><section className="panel stack"><div className="filters"><select className="select" aria-label="Filter status" value={status} onChange={event=>{setStatus(event.target.value);setCursor('');}}><option value="">Semua status</option>{Object.entries(STATUS_LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><input className="input" placeholder="Cari kode atau nama" aria-label="Cari pesanan" value={query} onChange={event=>setQuery(event.target.value)}/></div><DataState {...state} retry={state.reload}/><div className="table-wrap" tabIndex={0} aria-label="Daftar pesanan"><table className="data-table"><thead><tr><th>Pesanan</th><th>Pemesan</th><th>Total</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{rows.map(order=><tr key={order.id}><td><strong>{order.order_code}</strong><p className="small muted">{new Date(order.created_at).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})}</p></td><td>{order.customer_name}</td><td className="numeric">{formatMoney(order.total)}</td><td><Badge tone={STATUS_TONES[order.status]}>{STATUS_LABELS[order.status]}</Badge></td><td><Button size="sm" variant="outline" onClick={()=>setSelected(order)}>{order.status==='menunggu_konfirmasi'?'Periksa pembayaran':'Detail'}</Button></td></tr>)}</tbody></table></div>{!state.loading&&!state.error&&!rows.length?<p>Belum ada pesanan yang cocok.</p>:null}<div className="row between"><Button variant="outline" disabled={!cursor} onClick={()=>setCursor('')}>Terbaru</Button><Button variant="outline" disabled={!state.data?.next_cursor} onClick={()=>setCursor(state.data?.next_cursor??'')}>Lebih lama</Button></div></section><Modal open={!!selected} onOpenChange={open=>{if(!open)setSelected(null);}} title="Detail pesanan" description={selected?.order_code??''}>{selected?<OrderDetail key={selected.id} id={selected.id} done={async()=>{setSelected(null);await state.reload();}}/>:null}</Modal></>;
}
const confirmationText = {
  accept: 'Terima pembayaran dan mulai siapkan pesanan?',
  reject: 'Tolak klaim pembayaran?',
  siap: 'Tandai pesanan siap diambil?',
  selesai: 'Tandai pesanan selesai?',
  dibatalkan: 'Batalkan pesanan dan kembalikan stok?',
};

function OrderDetail({ id, done }: { id: string; done: () => Promise<void> }) {
  const { request } = useManagement();
  const load = useCallback(() => request('/api/admin/orders/' + id, OrderDetailResponseSchema), [request, id]);
  const state = useLoad(load);
  const order = state.data?.data;
  const merchant = state.data?.payment_merchant_name;
  const [reason, setReason] = useState('');
  const [action, setAction] = useState<keyof typeof confirmationText | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!order || !action || busy || (action === 'accept' && !merchant)) return;
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
      {state.data?.items.map(item => <div className="row between" key={item.id}>
        <span>{item.qty} × {item.menu_name}</span><span>{formatMoney(item.subtotal)}</span>
      </div>)}
      <div className="row between"><strong>Total</strong><strong>{formatMoney(order.total)}</strong></div>
      <p>Merchant QRIS: {merchant ?? 'Belum dapat dimuat'}</p>
      {order.status === 'menunggu_konfirmasi' && <p className="notice small">
        Cocokkan nominal dan merchant dengan mutasi pembayaran sebelum menerima.
      </p>}
      {action ? <>
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
        {order.status === 'diproses' && <Button onClick={() => setAction('siap')}>Tandai siap</Button>}
        {order.status === 'siap' && <Button onClick={() => setAction('selesai')}>Selesai</Button>}
        {(order.status === 'menunggu_bayar' || order.status === 'menunggu_konfirmasi') &&
          <Button variant="outline" onClick={() => setAction('dibatalkan')}>Batalkan pesanan</Button>}
      </div>}
    </>}
    {error && <div className="stack">
      <p className="form-error" role="alert">{error}</p>
      <Button variant="outline" onClick={() => { setAction(null); setError(''); void state.reload(); }}>
        Muat ulang detail
      </Button>
    </div>}
  </div>;
}
