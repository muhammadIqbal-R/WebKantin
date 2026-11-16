'use client';
import Link from 'next/link';
import { Badge, Button, CircleAlert, ExternalLink, LogOut, Settings2, Store, Users } from '@kantin/ui';
import { useDemo } from '@kantin/ui/demo';
export default function AccountPage() {
  const { role, tenants } = useDemo();
  const isAdmin = role === 'admin_pengelola';
  return <><div className="page-intro"><div><div className="eyebrow text-action">AKUN PENGELOLA</div><h1 style={{ marginTop: 'var(--s2)' }}>Akun & akses</h1><p>Lihat peran dan batas akses akun pengelola.</p></div><Badge>Identitas contoh</Badge></div>
    <div className="account-grid"><section className="panel"><div className="tenant-detail"><span className="avatar">{isAdmin ? 'AP' : 'BS'}</span><div><h2>{isAdmin ? 'Admin Pengelola' : tenants[0]?.name}</h2><p>{isAdmin ? 'admin@example.com' : tenants[0]?.email}</p></div><Badge tone="success">{isAdmin ? 'Admin' : 'Tenant'}</Badge></div>
      <div className="settings-list"><div className="settings-row"><div><strong>Peran akun</strong><p>{isAdmin ? 'Mengelola seluruh kantin dan tenant' : 'Mengelola menu dan pesanan tenant sendiri'}</p></div><Users /></div>
        <div className="settings-row"><div><strong>Lokasi</strong><p>Kantin Fakultas</p></div><Store /></div>
        <div className="settings-row"><div><strong>Autentikasi</strong><p>Supabase Auth belum dihubungkan</p></div><Badge>Placeholder</Badge></div></div>
      <div className="form-actions"><Button variant="outline" asChild><Link href="/login"><LogOut />Halaman masuk</Link></Button></div>
    </section><section className="panel"><h2 className="row"><Settings2 />Pembagian akses</h2><div className="stack" style={{ marginTop: 'var(--s5)' }}><p className="small muted">Admin pengelola menambah tenant dan akun tenant, serta mengelola menu seluruh tenant. Akun tenant hanya mengelola menu dan pesanan miliknya sendiri.</p>
      <p className="notice small"><CircleAlert />Akun staf dan penyimpanan data belum terhubung API.</p><a className="link-action" href={process.env.NEXT_PUBLIC_USER_URL ?? 'http://localhost:3000'} target="_blank" rel="noreferrer">Buka web pemesan<ExternalLink /></a></div></section></div></>;
}
