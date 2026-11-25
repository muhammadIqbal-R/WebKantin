'use client';

import { useEffect, useState } from 'react';
import { ChatInboxSchema, type OrderMessageSender } from '@kantin/shared';
import { Button, Modal } from './primitives';
import { OrderChat, type RequestChat } from './order-chat';

export function ChatInbox({ request, side }: { request:RequestChat; side:OrderMessageSender }) {
  const [data, setData] = useState<ReturnType<typeof ChatInboxSchema.parse>>();
  const [selected, setSelected] = useState<{order_id:string;order_code:string} | null>(null);
  const [opened, setOpened] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const prefix = side === 'tenant' ? '/api/admin' : '/api';

  useEffect(() => {
    let active = true;
    let running = false;
    async function sync() {
      if (running) return;
      running = true;
      try {
        const next = await request(prefix + '/chat-inbox', ChatInboxSchema);
        if (active) { setData(next); setError(''); }
      } catch {
        if (active) setError('Kotak pesan belum bisa dimuat.');
      } finally { running = false; }
    }
    void sync();
    const timer = setInterval(() => void sync(), 10000);
    const read = () => void sync();
    window.addEventListener('kantin-chat-read', read);
    window.addEventListener('focus', read);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('kantin-chat-read', read);
      window.removeEventListener('focus', read);
    };
  }, [request, prefix, revision]);

  return <>
    <Button variant="outline" size="sm" onClick={() => { setOpened(true); setRevision(value=>value+1); }}>
      Pesan{data?.unread ? ' · ' + data.unread + ' chat baru' : ''}
    </Button>
    <span className="sr-only" role="status">{data?.unread ? data.unread + ' percakapan dengan pesan belum dibaca' : ''}</span>
    <Modal open={opened} onOpenChange={open => {
      setOpened(open);
      if (!open) setSelected(null);
    }} title="Kotak pesan" description={selected?.order_code ?? 'Percakapan dengan pesan belum dibaca'}>
      {selected ? <>
        <Button variant="outline" size="sm" onClick={() => setSelected(null)}>Kembali ke kotak pesan</Button>
        <OrderChat key={selected.order_id} request={request} side={side}
          path={prefix + '/orders/' + selected.order_id + '/messages'} />
      </> : <div className="stack">
        {error ? <p role="alert">{error}</p> : !data ? <p role="status">Memuat pesan…</p> : null}
        {error && <Button variant="outline" onClick={() => setRevision(value=>value+1)}>Coba lagi</Button>}
        {!error && data?.unread===0 && <p>Semua pesan sudah dibaca. Riwayat ada di detail pesanan.</p>}
        {data?.data.map(item => <Button variant="outline" key={item.order_id} onClick={() => setSelected(item)}>
          {item.order_code} · {item.unread} pesan
        </Button>)}
      </div>}
    </Modal>
  </>;
}
