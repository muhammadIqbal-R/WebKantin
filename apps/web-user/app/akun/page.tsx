'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { NameSchema } from '@kantin/shared';
import { Button, EmptyState, Users } from '@kantin/ui';
import { useCustomerAuth } from '../../components/customer-auth';
export default function CustomerAccountPage() {
  const { user, loading, signOut } = useCustomerAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (loading) return <p role="status">Memuat akun…</p>;
  if (!user) return <section className="panel"><EmptyState icon={<Users />} title="Masuk ke akun pelanggan" description="Akun diperlukan sebelum checkout." action={<Button asChild><Link href="/masuk">Masuk / buat akun</Link></Button>} /></section>;
  const name = NameSchema.safeParse(user.user_metadata?.display_name);
  async function logout() {
    setBusy(true);setError('');
    if (await signOut()) { router.replace('/'); return; }
    setError('Belum dapat keluar. Coba lagi.');setBusy(false);
  }
  return <div className="auth-layout"><div className="auth-intro"><p className="eyebrow">AKUN PELANGGAN</p><h1>{name.success?name.data:'Pelanggan kantin'}</h1><p>{user.email}</p></div><section className="auth-panel stack"><h2>Akun Anda</h2><p className="muted">Katalog dan pesanan masih data contoh. Riwayat pesanan akun akan tersedia setelah API terhubung.</p><Button onClick={()=>router.push('/checkout')}>Lanjut checkout</Button><Button variant="outline" onClick={logout} loading={busy}>Keluar</Button>{error?<p role="alert" className="form-error">{error}</p>:null}</section></div>;
}
