'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import {
  ORDER_MESSAGE_MAX, OrderMessageResponseSchema, OrderMessagesResponseSchema,
  MarkChatReadResponseSchema, SendOrderMessageSchema,
  type OrderMessage, type OrderMessagesResponse, type OrderMessageSender,
} from '@kantin/shared';
import { Button, Field } from './primitives';

export type RequestChat = <T>(
  path: string, schema: { parse: (value: unknown) => T }, method?: 'GET' | 'POST', body?: unknown,
) => Promise<T>;

const timestamp = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
});

function mergeMessages(first: OrderMessage[], second: OrderMessage[]) {
  const seen = new Set(first.map(message => message.id));
  return [...first, ...second.filter(message => !seen.has(message.id))];
}

export function OrderChat({ request, path, side }: { request: RequestChat; path: string; side: OrderMessageSender }) {
  const heading = useId();
  const [thread, setThread] = useState<OrderMessagesResponse | null>(null);
  const [text, setText] = useState('');
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [actionError, setActionError] = useState('');
  const [revision, setRevision] = useState(0);
  const pending = useRef<{ id: string; text: string } | null>(null);
  const lastRead = useRef('');
  const scrollBox = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);

  useEffect(() => {
    let active = true;
    let running = false;
    async function sync() {
      if (running) return;
      running = true;
      try {
        const page = await request(path, OrderMessagesResponseSchema);
        if (!active) return;
        setThread(current => {
          if (!current) return page;
          const known = new Set(current.data.map(message => message.id));
          // Reset to the current window after a long pause so history stays contiguous.
          if (page.data.length === 30 && current.data.length && !page.data.some(message => known.has(message.id))) return page;
          return { ...current, closed: current.closed || page.closed, data: mergeMessages(current.data, page.data) };
        });
        setSyncError('');
        const latestIncoming = page.data.filter(item => item.sender !== side).at(-1);
        if (latestIncoming && latestIncoming.id !== lastRead.current && !document.hidden) {
          try {
            await request(path + '/read', MarkChatReadResponseSchema, 'POST', { message_id:latestIncoming.id });
            lastRead.current = latestIncoming.id;
            window.dispatchEvent(new Event('kantin-chat-read'));
          } catch {
            // The next sync can retry the receipt without interrupting the conversation.
          }
        }
      } catch (failure) {
        if (active) setSyncError(failure instanceof Error ? failure.message : 'Chat belum dapat dimuat.');
      } finally { running = false; }
    }
    void sync();
    const timer = setInterval(() => { if (!document.hidden) void sync(); }, 5000);
    function onVisible() { if (!document.hidden) void sync(); }
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [request, path, revision, side]);

  const lastMessage = thread?.data.at(-1)?.id;
  useEffect(() => {
    const element = scrollBox.current;
    if (element && followLatest.current) element.scrollTop = element.scrollHeight;
  }, [lastMessage]);

  async function loadOlder() {
    const cursor = thread?.next_cursor;
    if (!cursor || loadingOlder) return;
    setLoadingOlder(true);
    setActionError('');
    try {
      const older = await request(path + '?cursor=' + encodeURIComponent(cursor), OrderMessagesResponseSchema);
      setThread(current => {
        if (!current || current.next_cursor !== cursor) return current;
        return { ...older, closed: current.closed || older.closed, data: mergeMessages(older.data, current.data) };
      });
    } catch (failure) {
      setActionError(failure instanceof Error ? failure.message : 'Riwayat belum dapat dimuat.');
    } finally { setLoadingOlder(false); }
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!thread || sending || thread.closed) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    const id = pending.current?.text === trimmed ? pending.current.id : crypto.randomUUID();
    const input = SendOrderMessageSchema.safeParse({ id, text: trimmed });
    if (!input.success) return;
    pending.current = input.data;
    setSending(true);
    setActionError('');
    try {
      await request(path, OrderMessageResponseSchema, 'POST', input.data);
      followLatest.current = true;
      pending.current = null;
      setText('');
      setRevision(value => value + 1);
    } catch (failure) {
      setActionError(failure instanceof Error ? failure.message : 'Pesan belum dapat dikirim. Coba kembali.');
    } finally { setSending(false); }
  }

  return <section className="order-chat stack" aria-labelledby={heading}>
    <h3 id={heading}>Percakapan</h3>
    {syncError
      ? <div className="stack"><p role="alert" className="form-error">{syncError}</p>
        <Button size="sm" variant="outline" onClick={() => setRevision(value => value + 1)}>Muat ulang chat</Button></div>
      : !thread && <p role="status">Memuat chat…</p>}
    {thread && <>
      <div ref={scrollBox} className="order-chat-history stack" role="log" aria-label="Riwayat pesan"
        tabIndex={0} onScroll={event => {
          const node = event.currentTarget;
          followLatest.current = node.scrollHeight - node.scrollTop - node.clientHeight < 36;
        }}>
        {thread.next_cursor && <Button variant="outline" size="sm" loading={loadingOlder}
          onClick={() => void loadOlder()}>Lihat pesan lebih lama</Button>}
        {!thread.data.length && <p className="small muted">Belum ada pesan.</p>}
        {thread.data.map(message => <article key={message.id}
          className={message.sender === side ? 'order-chat-message own-message' : 'order-chat-message'}>
          <div className="row between wrap small">
            <strong>{message.sender === side ? 'Anda' : message.sender === 'tenant' ? 'Tenant' : 'Pelanggan'}</strong>
            <time className="muted" dateTime={message.created_at}>{timestamp.format(new Date(message.created_at))}</time>
          </div>
          <p>{message.text}</p>
        </article>)}
      </div>
      {thread.closed ? <p className="small muted">Pesanan sudah ditutup. Riwayat masih bisa dibaca.</p>
        : <form className="stack" onSubmit={send}>
          <Field label="Pesan"><textarea className="textarea" rows={3} maxLength={ORDER_MESSAGE_MAX}
            value={text} disabled={sending} onChange={event => setText(event.target.value)} /></Field>
          <Button type="submit" loading={sending} disabled={!text.trim()}>Kirim pesan</Button>
        </form>}
      {actionError && <p className="form-error" role="alert">{actionError}</p>}
    </>}
  </section>;
}
