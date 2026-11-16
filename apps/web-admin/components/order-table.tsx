'use client';
import { useState } from 'react';
import { Badge, Button, Check, Clock3, EmptyState, Field, Modal, PackageOpen, ReceiptText, UtensilsCrossed, formatMoney } from '@kantin/ui';
import { ConfirmPaymentRequestSchema } from '@kantin/shared';
import { STATUS_LABELS, STATUS_TONES, useDemo, type DemoOrder } from '@kantin/ui/demo';
export function OrderTable({ entries, showActions = true }: { entries: DemoOrder[]; showActions?: boolean }) {
  const { updateOrder } = useDemo();
  const [detail, setDetail] = useState<string | null>(null);
  const [decision, setDecision] = useState<'accept' | 'reject' | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const selected = entries.find((entry) => entry.order.id === detail);
  function decide() {
    if (!selected || !decision) return;
    const result = ConfirmPaymentRequestSchema.safeParse({ expected_version: selected.order.version, decision,
      ...(decision === 'reject' ? { reason } : {}) });
    if (!result.success) { setError('Tuliskan alasan penolakan, minimal 2 karakter.'); return; }
    updateOrder(selected.order.id, decision, reason); setDecision(null); setDetail(null); setReason(''); setError('');
  }
  if (!entries.length) return <EmptyState icon={<ReceiptText />} title="Tidak ada pesanan di daftar ini" description="Coba filter lain untuk melihat pesanan contoh yang tersedia." />;
  return <>
    <div className="mobile-order-list">{entries.map(({order,items})=><article className="mobile-order-row" key={order.id}><div className="row between wrap"><strong className="order-code">{order.order_code.replace("KT-DEMO","#")}</strong><Badge tone={STATUS_TONES[order.status]}>{STATUS_LABELS[order.status]}</Badge></div><h3>{order.customer_name}</h3><p className="small muted">{items.reduce((sum,item)=>sum+item.qty,0)} item · {order.order_type==="dine_in"?"Makan di tempat":"Bawa pulang"}</p><div className="row between"><strong className="numeric">{formatMoney(order.total)}</strong>{showActions&&order.status==="diproses"?<Button variant="secondary" size="sm" onClick={()=>updateOrder(order.id,"ready")}>Tandai siap</Button>:showActions&&order.status==="siap"?<Button variant="outline" size="sm" onClick={()=>updateOrder(order.id,"complete")}>Selesai</Button>:<Button size="sm" variant={order.status==="menunggu_konfirmasi"?"primary":"outline"} onClick={()=>{setDetail(order.id);setDecision(null);setReason("");setError("");}}>{order.status==="menunggu_konfirmasi"?"Periksa":"Detail"}</Button>}</div></article>)}</div>
    <div className="table-wrap order-desktop-table" tabIndex={0} aria-label="Tabel pesanan, dapat digulir horizontal"><table className="data-table"><thead><tr><th>Pesanan</th><th>Pemesan</th><th>Tipe</th><th>Total</th><th>Status</th><th className="text-right">Aksi</th></tr></thead>
      <tbody>{entries.map(({ order, items }) => <tr key={order.id}><td><strong className="order-code text-action">{order.order_code.replace('KT-DEMO', '#')}</strong><p className="small muted">{new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).format(new Date(order.created_at))} WIB · {items.reduce((sum, item) => sum + item.qty, 0)} item</p></td>
        <td><div className="row"><span className="avatar">{order.customer_name.split(' ').slice(0,2).map((part) => part[0]).join('')}</span><span>{order.customer_name}</span></div></td>
        <td><span className="row muted">{order.order_type === 'dine_in' ? <UtensilsCrossed /> : <PackageOpen />}{order.order_type === 'dine_in' ? 'Dine in' : 'Take away'}</span></td>
        <td className="numeric"><strong>{formatMoney(order.total)}</strong></td><td><Badge tone={STATUS_TONES[order.status]}>{order.status === 'menunggu_konfirmasi' ? <Clock3 /> : null}{STATUS_LABELS[order.status]}</Badge></td>
        <td className="text-right">{showActions && order.status === 'diproses' ? <Button variant="secondary" size="sm" onClick={() => updateOrder(order.id, 'ready')}>Tandai siap</Button>
          : showActions && order.status === 'siap' ? <Button variant="outline" size="sm" onClick={() => updateOrder(order.id, 'complete')}><Check />Selesai</Button>
          : <Button variant={order.status === 'menunggu_konfirmasi' ? 'secondary' : 'ghost'} size="sm" onClick={() => { setDetail(order.id); setDecision(null); setReason(''); setError(''); }}>{order.status === 'menunggu_konfirmasi' ? 'Periksa' : 'Detail'}</Button>}</td></tr>)}</tbody></table></div>
    <Modal open={!!selected} onOpenChange={(open) => { if (!open) { setDetail(null); setDecision(null); } }} title={decision === 'reject' ? 'Tolak pembayaran contoh?' : decision === 'accept' ? 'Terima pembayaran contoh?' : 'Detail pesanan'} description="Tindakan ini hanya mengubah data contoh di pratinjau frontend.">
      {selected ? <div className="stack"><div className="row between"><div><p className="order-code">{selected.order.order_code}</p><h3>{selected.order.customer_name}</h3></div><Badge tone={STATUS_TONES[selected.order.status]}>{STATUS_LABELS[selected.order.status]}</Badge></div>
        <div className="detail-lines">{selected.items.map((item) => <div className="row between" key={item.id}><span>{item.qty} × {item.menu_name}</span><strong>{formatMoney(item.subtotal)}</strong></div>)}</div>
        <div className="row between"><span>Total QRIS</span><h2>{formatMoney(selected.order.total)}</h2></div>
        {decision === 'reject' ? <Field label="Alasan penolakan"><textarea className="textarea" value={reason} onChange={(event) => { setReason(event.target.value); setError(''); }} placeholder="Contoh: mutasi pembayaran belum ditemukan" maxLength={300} aria-invalid={!!error} /></Field> : null}
        {decision === 'accept' ? <p className="notice small">Pada aplikasi operasional, cocokkan merchant dan nominal pada mutasi sebelum menerima. Pada pratinjau ini tidak ada verifikasi pembayaran sungguhan.</p> : null}
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        {showActions && selected.order.status === 'menunggu_konfirmasi' ? <div className="form-actions">{decision ? <><Button variant="outline" onClick={() => setDecision(null)}>Kembali</Button><Button variant={decision === 'reject' ? 'danger' : 'primary'} onClick={decide}>{decision === 'reject' ? 'Tolak contoh' : 'Ya, terima contoh'}</Button></>
          : <><Button variant="danger" onClick={() => setDecision('reject')}>Tolak</Button><Button onClick={() => setDecision('accept')}><Check />Terima pembayaran</Button></>}</div>
          : <div className="form-actions"><Button variant="outline" onClick={() => setDetail(null)}>Tutup</Button></div>}
      </div> : null}
    </Modal>
  </>;
}
