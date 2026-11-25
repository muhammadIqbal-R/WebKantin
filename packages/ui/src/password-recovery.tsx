'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { RecoveryEmailSchema, RecoveryPasswordSchema } from '@kantin/shared';
import { Button, Field } from './primitives';

export interface RecoveryClient {
  request(email:string, url:string):Promise<void>;
  verify(token:string):Promise<boolean>;
  update(password:string):Promise<boolean>;
}

export function PasswordRecovery({ client, back }: {
  client: () => RecoveryClient | null;
  back: ReactNode;
}) {
  const [link, setLink] = useState<string | null | undefined>(undefined);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const recovery = useRef<RecoveryClient | null>(null);
  const verified = useRef(false);

  useEffect(() => {
    let active = true;
    function readLink() {
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      const token = fragment.get('type') === 'recovery' ? fragment.get('token_hash') : null;
      queueMicrotask(() => {
        if (!active) return;
        verified.current = false;
        recovery.current = null;
        setSaved(false);
        setError('');
        setMessage('');
        setPassword('');
        setConfirmation('');
        setLink(token && /^[\w.-]{16,512}$/.test(token) ? token : null);
      });
    }
    readLink();
    window.addEventListener('hashchange',readLink);
    return () => { active = false; window.removeEventListener('hashchange',readLink); };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    recovery.current ??= client();
    const auth = recovery.current;
    if (!auth) { setError('Layanan akun belum tersedia.'); return; }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (!link) {
        const input = RecoveryEmailSchema.safeParse({email});
        if (!input.success) { setError('Masukkan email yang valid.'); return; }
        await auth.request(input.data.email, window.location.origin + window.location.pathname);
        if (recovery.current !== auth) return;
        setMessage('Jika akun terdaftar, tautan reset akan dikirim. Periksa inbox dan folder spam.');
        return;
      }
      const input = RecoveryPasswordSchema.safeParse({password,password_confirmation:confirmation});
      if (!input.success) { setError('Password minimal 8 karakter dan kedua isian harus sama.'); return; }
      if (!verified.current) {
        const valid = await auth.verify(link);
        if (recovery.current !== auth) return;
        verified.current = valid;
        if (!verified.current) {
          window.history.replaceState(window.history.state, '', window.location.pathname);
          setError('Tautan sudah habis atau tidak valid. Minta tautan baru.');
          setLink(null);
          setPassword('');
          setConfirmation('');
          return;
        }
        window.history.replaceState(window.history.state, '', window.location.pathname);
      }
      const updated = await auth.update(input.data.password);
      if (recovery.current !== auth) return;
      if (!updated) {
        setError('Password belum bisa disimpan. Coba password lain atau minta tautan baru.');
        return;
      }
      setPassword('');
      setConfirmation('');
      setSaved(true);
    } catch {
      setError('Layanan akun belum dapat dihubungi. Coba kembali sebentar lagi.');
    } finally { setBusy(false); }
  }

  return <div className="stack">
    <h1>{saved ? 'Password diperbarui' : link ? 'Buat password baru' : 'Lupa password'}</h1>
    {saved ? <p role="status">Masuk kembali dengan password yang baru.</p>
      : link === undefined ? <p role="status">Memuat…</p>
      : <form className="stack" onSubmit={submit}>
        {link ? <>
          <Field label="Password baru"><input className="input" type="password" autoComplete="new-password"
            required minLength={8} maxLength={128} disabled={busy} value={password} onChange={event=>setPassword(event.target.value)} /></Field>
          <Field label="Konfirmasi password"><input className="input" type="password" autoComplete="new-password"
            required minLength={8} maxLength={128} disabled={busy} value={confirmation} onChange={event=>setConfirmation(event.target.value)} /></Field>
        </> : <Field label="Email akun">
          <input className="input" type="email" autoComplete="email" required maxLength={320}
            disabled={busy} value={email} onChange={event=>setEmail(event.target.value)} />
        </Field>}
        {error && <p role="alert" className="form-error">{error}</p>}
        {message && <p role="status">{message}</p>}
        <Button type="submit" loading={busy}>{link ? 'Simpan password' : 'Kirim tautan reset'}</Button>
      </form>}
    {back}
  </div>;
}
