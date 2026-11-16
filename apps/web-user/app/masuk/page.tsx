'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CustomerSignInSchema, CustomerSignUpSchema } from '@kantin/shared';
import { ArrowRight, Button, Field } from '@kantin/ui';
import { getCustomerAuthClient } from '../../lib/supabase';
import { useCustomerAuth } from '../../components/customer-auth';
export default function CustomerSignInPage() {
  const router = useRouter();
  const { user, loading } = useCustomerAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  function switchMode(value: 'signin' | 'signup') { setMode(value); setError(''); setMessage(''); setPassword(''); setConfirmation(''); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage('');
    const parsed = mode === 'signup' ? CustomerSignUpSchema.safeParse({ display_name: name, email, password, password_confirmation: confirmation }) : CustomerSignInSchema.safeParse({ email, password });
    if (!parsed.success) { setError(mode === 'signup' ? 'Periksa nama dan email. Password minimal 8 karakter dan konfirmasi harus sama.' : 'Isi email dan password yang valid.'); return; }
    const client = getCustomerAuthClient();
    if (!client) { setError('Layanan masuk belum dikonfigurasi. Coba lagi nanti.'); return; }
    setBusy(true);
    try {
      if (mode === 'signup') {
        const input = CustomerSignUpSchema.parse(parsed.data);
        const { data, error: failure } = await client.auth.signUp({ email: input.email, password: input.password, options: { data: { display_name: input.display_name }, emailRedirectTo: window.location.origin + '/masuk' } });
        if (failure) { setError('Pendaftaran belum dapat diproses. Periksa isian atau coba lagi nanti.'); return; }
        setPassword(''); setConfirmation('');
        if (data.session) { router.replace('/checkout'); return; }
        setMessage('Jika pendaftaran dapat diproses, tautan konfirmasi dikirim ke email Anda. Periksa inbox sebelum masuk.');
      } else {
        const input = CustomerSignInSchema.parse(parsed.data);
        const { error: failure } = await client.auth.signInWithPassword({ email: input.email, password: input.password });
        if (failure) { setError('Belum dapat masuk. Periksa email, password, dan konfirmasi email Anda.'); return; }
        setPassword(''); router.replace('/checkout');
      }
    } catch { setError('Layanan belum dapat dihubungi. Periksa koneksi lalu coba kembali.'); }
    finally { setBusy(false); }
  }
  if (!loading && user) return <section className="auth-panel"><h1>Anda sudah masuk</h1><p className="muted">{user.email}</p><div className="form-actions"><Button asChild><Link href="/checkout">Lanjut checkout<ArrowRight /></Link></Button><Button variant="outline" asChild><Link href="/akun">Lihat akun</Link></Button></div></section>;
  return <div className="auth-layout"><section className="auth-intro"><p className="eyebrow">AKUN PELANGGAN</p><h1>Masuk atau buat akun</h1><Link href="/" className="link-action" style={{ marginTop: 'var(--s6)' }}>Kembali ke menu<ArrowRight /></Link></section>
    <section className="auth-panel"><div className="auth-tabs"><button className={mode==='signin'?'active':''} onClick={()=>switchMode('signin')} aria-pressed={mode==='signin'}>Masuk</button><button className={mode==='signup'?'active':''} onClick={()=>switchMode('signup')} aria-pressed={mode==='signup'}>Buat akun</button></div>
      {message ? <p className="auth-notice" role="status">{message}</p> : null}
      <form onSubmit={submit}>
        {mode==='signup'?<Field label="Nama lengkap"><input className="input" required minLength={2} maxLength={100} autoComplete="name" value={name} onChange={event=>setName(event.target.value)} /></Field>:null}
        <Field label="Email"><input className="input" type="email" required autoComplete="email" maxLength={320} value={email} onChange={event=>setEmail(event.target.value)} /></Field>
        <Field label="Password" hint={mode==='signup'?'Minimal 8 karakter.':undefined}><input className="input" type="password" required minLength={mode==='signup'?8:1} maxLength={128} autoComplete={mode==='signup'?'new-password':'current-password'} value={password} onChange={event=>setPassword(event.target.value)} /></Field>
        {mode==='signup'?<Field label="Konfirmasi password"><input className="input" type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={confirmation} onChange={event=>setConfirmation(event.target.value)} /></Field>:null}
        {error?<p className="form-error" role="alert" style={{marginBottom:'var(--s4)'}}>{error}</p>:null}
        <Button className="full" type="submit" loading={busy} disabled={loading}>{mode==='signup'?'Buat akun':'Masuk'}<ArrowRight /></Button>
      </form>
    </section>
  </div>;
}
