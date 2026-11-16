'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Badge, Brand, Button, CheckCircle2, ClipboardList, ExternalLink, LayoutDashboard, MapPin, MenuIcon, Modal, Settings2, Store, UtensilsCrossed, X } from '@kantin/ui';
import { DemoProvider, useDemo } from '@kantin/ui/demo';
const navigation = [
  { path: '/', label: 'Ringkasan', icon: LayoutDashboard },
  { path: '/pesanan', label: 'Pesanan', icon: ClipboardList },
  { path: '/menu', label: 'Menu', icon: UtensilsCrossed },
  { path: '/tenant', label: 'Tenant', icon: Store },
  { path: '/denah', label: 'Denah kantin', icon: MapPin },
  { path: '/akun', label: 'Akun & akses', icon: Settings2 },
];
export function AdminShell({ children }: { children: ReactNode }) {
  return <DemoProvider surface="admin"><Chrome>{children}</Chrome></DemoProvider>;
}
function Chrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { orders, role, notice, notify } = useDemo();
  const [menuOpen,setMenuOpen] = useState(false);
  const pending = orders.filter(({order}) => order.status === 'menunggu_konfirmasi').length;
  const pageTitle = navigation.find(entry => entry.path === pathname)?.label ?? 'Kantin Vokasi';
  const links = navigation.filter(entry => role === 'admin_pengelola' || !['/tenant','/denah'].includes(entry.path));
  function navLinks() {
    return links.map(({path,label,icon:Icon}) => <Link key={path} href={path} onClick={() => setMenuOpen(false)} className={pathname === path ? 'active' : ''} aria-current={pathname === path ? 'page' : undefined}><Icon /><span>{label}</span>{path === '/pesanan' && pending ? <Badge>{pending}</Badge> : null}</Link>);
  }
  if(pathname === '/login') return <>{children}</>;
  return <div className="admin-app">
    <aside className="admin-sidebar"><Link href="/" aria-label="Kantin Vokasi, ringkasan"><Brand /></Link><nav className="admin-nav" aria-label="Navigasi pengelola">{navLinks()}</nav><div className="sidebar-bottom"><a className="link-action" href={process.env.NEXT_PUBLIC_USER_URL ?? 'http://localhost:3000'}>Lihat menu pelanggan<ExternalLink /></a></div></aside>
    <div className="admin-body"><header className="admin-topbar"><div className="admin-mobile-brand"><Brand /></div><strong className="breadcrumb">{pageTitle}</strong><div className="topbar-actions"><a className="link-action" href={process.env.NEXT_PUBLIC_USER_URL ?? 'http://localhost:3000'}>Lihat menu<ExternalLink /></a><Button className="admin-menu-toggle" variant="outline" size="icon" aria-label="Buka navigasi pengelola" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><MenuIcon /></Button></div></header><main className="admin-main">{children}</main></div>
    <Modal open={menuOpen} onOpenChange={setMenuOpen} title="Navigasi" description="Kantin Vokasi UI"><nav className="admin-nav mobile-admin-nav" aria-label="Navigasi pengelola HP">{navLinks()}</nav></Modal>
    {notice ? <div className="toast" role="status"><CheckCircle2 /><span>{notice}</span><Button variant="ghost" size="icon" onClick={() => notify('')} aria-label="Tutup pemberitahuan"><X /></Button></div> : null}
  </div>;
}

