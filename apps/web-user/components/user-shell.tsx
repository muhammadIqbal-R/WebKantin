'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Brand, Button, CheckCircle2, ExternalLink, MapPin, ReceiptText, ShoppingBag, Users, UtensilsCrossed, X } from '@kantin/ui';
import { useCustomerAuth } from './customer-auth';
import { DemoProvider, useDemo } from '@kantin/ui/demo';

export function UserShell({ children }: { children: ReactNode }) {
  const { epoch } = useCustomerAuth();
  return <DemoProvider key={epoch} surface="user"><Chrome>{children}</Chrome></DemoProvider>;
}
function Chrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useCustomerAuth();
  const { cart, menus, notice, notify } = useDemo();
  const count = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  const total = menus.reduce((sum, item) => sum + item.price * (cart[item.id] ?? 0), 0);
  return <>
    {process.env.NEXT_PUBLIC_QA_AUTH_SIMULATED === "true" ? <div className="demo-banner">QA TERISOLASI · AUTH SIMULASI</div> : null}
    <header className="site-header"><div className="user-container header-inner">
      <Link href="/" aria-label="Kantin Vokasi UI, beranda"><Brand /></Link>
      <nav className="main-nav" aria-label="Navigasi utama">
        <Link href="/" className={pathname === '/' || pathname === '/checkout' ? 'active' : ''}><UtensilsCrossed />Menu</Link>
        <Link href="/pesanan" className={pathname === '/pesanan' ? 'active' : ''}><ReceiptText />Pesanan</Link>
        <Link href="/lokasi" className={pathname === '/lokasi' ? 'active' : ''}><MapPin />Lokasi</Link>
        <Link href={user ? "/akun" : "/masuk"} className={pathname === "/akun" || pathname === "/masuk" ? "active" : ""}><Users />{user ? "Akun" : "Masuk"}</Link>
      </nav>
      <span className="row header-place"><MapPin />Kampus UI Depok</span>
      <Button variant="outline" size="sm" asChild><Link href="/checkout" aria-label={'Keranjang, ' + count + ' item'}><ShoppingBag /><span className="numeric">{count}</span></Link></Button>
    </div></header>
    <main className="user-container user-main">{children}</main>
    {count > 0 && pathname === '/' ? <div className="mobile-cart"><Button asChild className="full"><Link href="/checkout"><ShoppingBag />{count} item · {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(total)}<span>Lihat keranjang</span></Link></Button></div> : null}
    <footer className="site-footer"><div className="user-container row between wrap"><span>Kantin Vokasi UI</span>
      <a className="row" href={process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://localhost:3001/login'}>Area pengelola<ExternalLink /></a>
    </div></footer>
    {notice ? <div className="toast" role="status"><CheckCircle2 /><span>{notice}</span><Button variant="ghost" size="icon" onClick={() => notify('')} aria-label="Tutup pemberitahuan"><X /></Button></div> : null}
    <span className="sr-only" role="status" aria-live="polite">{count} item di keranjang.</span>
  </>;
}
