'use client';

import { useState, type FormEvent } from 'react';
import {
  OrderRefundResponseSchema, RequestRefundSchema, UpdateRefundSchema, type OrderRefund,
} from '@kantin/shared';
import { Badge, Button, Field, formatMoney } from './primitives';

type RequestRefund = <T>(
  path:string, schema:{parse:(value:unknown)=>T}, method:'POST'|'PATCH', body:unknown,
) => Promise<T>;
const labels = {
  diminta:'Menunggu pemeriksaan', diproses:'Sedang diproses',
  ditolak:'Ditolak', dikembalikan:'Dana dikembalikan',
};

export function OrderRefundPanel({ refund, available, amount, path, staff, request, refresh }: {
  refund:OrderRefund | null;
  available:boolean;
  amount:number;
  path:string;
  staff?:boolean;
  request:RequestRefund;
  refresh:()=>Promise<void>;
}) {
  const [action, setAction] = useState<'request'|'take'|'reject'|'complete'|null>(null);
  const [text, setText] = useState('');
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!refund && (staff || !available)) return null;

  function choose(next:typeof action) {
    setAction(next);
    setText('');
    setVerified(false);
    setError('');
  }

  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !action) return;
    const body = action==='request' ? RequestRefundSchema.safeParse({reason:text})
      : UpdateRefundSchema.safeParse({
        action, expected_version:refund?.version,
        ...(action==='reject' ? {note:text} : {}),
        ...(action==='complete' ? {transfer_ref:text} : {}),
      });
    if (!body.success || (action==='take' && !verified)) { setError('Lengkapi isian sebelum melanjutkan.'); return; }
    setBusy(true);
    setError('');
    try {
      await request(path,OrderRefundResponseSchema,action==='request'?'POST':'PATCH',body.data);
      choose(null);
      await refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Refund belum dapat disimpan.');
    } finally { setBusy(false); }
  }

  return <section className="refund-panel stack" aria-label="Pengembalian dana">
    <div className="row between wrap">
      <strong>Refund · {formatMoney(refund?.amount ?? amount)}</strong>
      {refund && <Badge tone={refund.status==='dikembalikan'?'success':'neutral'}>{labels[refund.status]}</Badge>}
    </div>
    {refund && <p className="small refund-copy">{refund.reason}</p>}
    {refund?.resolution_note && <p className="small refund-copy">Alasan penolakan: {refund.resolution_note}</p>}
    {staff && refund?.source==='expired_claim' && <p className="small">
      Pelanggan melaporkan transfer setelah pesanan kedaluwarsa. Periksa mutasi merchant sebelum mengambil pengajuan.
    </p>}
    {!action && <>
      {!refund && <Button size="sm" variant="outline" onClick={()=>choose('request')}>Ajukan refund</Button>}
      {staff && refund?.status==='diminta' && <div className="form-actions">
        <Button size="sm" variant="outline" onClick={()=>choose('take')}>Ambil penanganan</Button>
        <Button size="sm" variant="outline" onClick={()=>choose('reject')}>Tolak pengajuan</Button>
      </div>}
      {staff && refund?.status==='diproses' && (refund.can_complete
        ? <Button size="sm" onClick={()=>choose('complete')}>Catat dana dikembalikan</Button>
        : <p className="small muted">Pengajuan ini ditangani petugas lain.</p>)}
    </>}
    {action && <form className="stack" onSubmit={submit}>
      {action==='take' ? <label className="row">
        <input type="checkbox" required checked={verified} disabled={busy} onChange={event=>setVerified(event.target.checked)} />
        Saya sudah mencocokkan pembayaran dengan mutasi merchant.
      </label> : <Field label={action==='complete'?'Referensi pengembalian':action==='reject'?'Alasan penolakan':'Alasan pengajuan'}>
        <textarea className="textarea" rows={2} minLength={2} maxLength={action==='complete'?100:300}
          required disabled={busy} value={text} onChange={event=>setText(event.target.value)} />
      </Field>}
      {action==='request' && <p className="small">Tenant akan memeriksa pengajuan. Sertakan alasan tanpa data rekening atau PIN.</p>}
      {action==='complete' && <p className="small">Isi setelah merchant benar-benar mengembalikan dana kepada pelanggan.</p>}
      <div className="form-actions">
        <Button size="sm" type="button" variant="outline" disabled={busy} onClick={()=>choose(null)}>Kembali</Button>
        <Button size="sm" type="submit" loading={busy}>Simpan</Button>
      </div>
    </form>}
    {error && <div className="stack"><p className="form-error" role="alert">{error}</p>
      <Button size="sm" variant="outline" onClick={()=>void refresh().catch(()=>setError('Pesanan belum bisa dimuat ulang.'))}>
        Muat ulang pesanan
      </Button></div>}
  </section>;
}
