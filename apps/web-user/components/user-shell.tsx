'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {Suspense,type ReactNode} from 'react';
import { Brand, Button, CheckCircle2, ExternalLink, MapPin, ReceiptText, ShoppingBag, Users, UtensilsCrossed, X } from '@kantin/ui';
import { useCustomerAuth } from './customer-auth';
import { DemoProvider, useDemo } from '@kantin/ui/demo';
import { LiveCatalog, CatalogContent } from './live-catalog';
import {CustomerOrders} from './customer-orders';

export function UserShell({ children }: { children: ReactNode }) {
  const { epoch } = useCustomerAuth();
  const content = <CustomerOrders><Chrome>{children}</Chrome></CustomerOrders>;
  return <Suspense fallback={<p role="status">Memuat kantin…</p>}>
    {process.env.NEXT_PUBLIC_QA_AUTH_SIMULATED === 'true'
      ? <DemoProvider key={epoch} surface="user">{content}</DemoProvider>
      : <LiveCatalog epoch={epoch}>{content}</LiveCatalog>}
  </Suspense>;
}
function Chrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const adminUrl=process.env.NEXT_PUBLIC_ADMIN_URL??(process.env.NODE_ENV==='development'?'http://localhost:3001/login':null);
  const { user } = useCustomerAuth();
  const { cart, menus, notice, notify } = useDemo();
  const count = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  const total = menus.reduce((sum, item) => sum + item.price * (cart[item.id] ?? 0), 0);
  return <>
    {process.env.NEXT_PUBLIC_QA_AUTH_SIMULATED === "true" ? <div className="demo-banner">QA TERISOLASI · AUTH SIMULASI</div> : null}
    <header className="site-header"><div className="user-container header-inner">
      <Link href="/" aria-label="Kantin Vokasi UI, beranda"><Brand /></Link>
      <nav className="main-nav" aria-label="Navigasi utama">
        <Link href="/" className={pathname === '/' || pathname === '/checkout' || pathname.startsWith('/tenant/') ? 'active' : ''}><UtensilsCrossed />Menu</Link>
        <Link href="/pesanan" className={pathname === '/pesanan' ? 'active' : ''}><ReceiptText />Pesanan</Link>
        <Link href="/lokasi" className={pathname === '/lokasi' ? 'active' : ''}><MapPin />Lokasi</Link>
        <Link href={user ? "/akun" : "/masuk"} className={pathname === "/akun" || pathname === "/masuk" ? "active" : ""}><Users />{user ? "Akun" : "Masuk"}</Link>
      </nav>
      <span className="row header-place"><MapPin />Kampus UI Depok</span>
      <Button variant="outline" size="sm" asChild><Link href="/checkout" aria-label={'Keranjang, ' + count + ' item'}><ShoppingBag /><span className="numeric">{count}</span></Link></Button>
    </div></header>
    <main className="user-container user-main"><CatalogContent>{children}</CatalogContent></main>
    {count > 0 && (pathname === '/' || pathname.startsWith('/tenant/')) ? <div className="mobile-cart"><Button asChild className="full"><Link href="/checkout"><ShoppingBag />{count} item · {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(total)}<span>Lihat keranjang</span></Link></Button></div> : null}
    <footer className="site-footer"><div className="user-container row between wrap"><span>Kantin Vokasi UI</span>
      {adminUrl?<a className="row" href={adminUrl}>Area pengelola<ExternalLink /></a>:null}
    </div></footer>
    {notice ? <div className="toast" role="status"><CheckCircle2 /><span>{notice}</span><Button variant="ghost" size="icon" onClick={() => notify('')} aria-label="Tutup pemberitahuan"><X /></Button></div> : null}
    <span className="sr-only" role="status" aria-live="polite">{count} item di keranjang.</span>
  </>;
}
