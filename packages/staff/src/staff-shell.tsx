'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Suspense, useState, type ReactNode } from 'react';
import { Brand, Button, ChatInbox, ChevronLeft, ClipboardList, ExternalLink, LayoutDashboard, MapPin, MenuIcon, Modal, Settings2, Store, UtensilsCrossed, LogOut } from '@kantin/ui';
import type { Role } from '@kantin/shared';
import { ManagementProvider, useManagement } from './management';
import {OrderNotifier} from './order-notifier';
const adminNavigation=[
  {path:'/',label:'Ringkasan',icon:LayoutDashboard},
  {path:'/pesanan',label:'Pantau pesanan',icon:ClipboardList},
  {path:'/tenant',label:'Tenant',icon:Store},
  {path:'/tenant/daftar',label:'Daftarkan tenant',icon:Store},
  {path:'/menu',label:'Menu & stok',icon:UtensilsCrossed},
  {path:'/denah',label:'Denah',icon:MapPin},
  {path:'/akun',label:'Akun & akses',icon:Settings2},
];
const tenantNavigation=[
  {path:'/',label:'Pesanan masuk',icon:ClipboardList},
  {path:'/menu',label:'Menu & stok',icon:UtensilsCrossed},
  {path:'/akun',label:'Akun saya',icon:Settings2},
];
export function StaffShell({children,role}:{children:ReactNode;role:Role}) {
  return <ManagementProvider><Suspense fallback={<main className="login-page"><p role="status">Memuat panel…</p></main>}>
    <Chrome role={role}>{children}</Chrome>
  </Suspense></ManagementProvider>;
}
function Chrome({children,role}:{children:ReactNode;role:Role}) {
  const pathname=usePathname(),router=useRouter();const {actor,loading,error,refreshIdentity,signOut,request}=useManagement();
  const userUrl=process.env.NEXT_PUBLIC_USER_URL??(process.env.NODE_ENV==='development'?'http://localhost:3000':null);
  const [menuOpen,setMenuOpen]=useState(false),[logoutError,setLogoutError]=useState('');
  const isAdmin=role==='admin_pengelola';
  const portal=isAdmin?'admin':'tenant';
  if(pathname==='/login'||pathname==='/lupa-password')return <>{children}</>;
  if(loading)return <main className="login-page"><section className="panel login-card"><Brand/><p role="status">Memeriksa akses {portal}…</p></section></main>;
  if(!actor)return <main className="login-page"><section className="panel login-card stack"><Brand/><h1>Masuk ke portal {portal}</h1><p role="alert">{error||'Silakan masuk untuk melanjutkan.'}</p><Button asChild><Link href="/login">Ke halaman masuk</Link></Button><Button variant="outline" onClick={()=>void refreshIdentity()}>Coba kembali</Button></section></main>;
  if(actor.role!==role)return <main className="login-page"><section className="panel login-card stack">
    <Brand/><h1>Akses portal {portal}</h1>
    <p role="alert">Akun ini tidak memiliki akses ke portal {portal}.</p>
    {isAdmin&&process.env.NEXT_PUBLIC_TENANT_URL&&<Button asChild><a href={process.env.NEXT_PUBLIC_TENANT_URL}>Buka portal tenant</a></Button>}
    <Button variant="outline" onClick={()=>void logout()}>Keluar</Button>
    {logoutError&&<p role="alert">{logoutError}</p>}
  </section></main>;
  const tenantDetail = pathname.startsWith('/tenant/') && pathname!=='/tenant/daftar';
  const activeSection = tenantDetail ? '/tenant' : pathname;
  const links = isAdmin ? adminNavigation : tenantNavigation;
  const back = pathname === '/' ? null : tenantDetail
    ? { href:'/tenant', label:'Kembali ke daftar tenant' }
    : { href:'/', label:isAdmin?'Kembali ke ringkasan':'Kembali ke pesanan' };

  function nav() {
    return links.map(({path,label,icon:Icon}) => <Link key={path} href={path}
      onClick={() => setMenuOpen(false)} className={activeSection === path ? 'active' : ''}
      aria-current={pathname === path ? 'page' : undefined}>
      <Icon /><span>{label}</span>
    </Link>);
  }

  async function logout() {
    try { await signOut(); router.replace('/login'); }
    catch (failure) { setLogoutError(failure instanceof Error ? failure.message : 'Belum dapat keluar.'); }
  }

  return <div className="admin-app">
    <aside className="admin-sidebar">
      <Link href="/" aria-label="Kantin Vokasi"><Brand /></Link>
      <nav className="admin-nav" aria-label={'Navigasi '+portal}>{nav()}</nav>
      <div className="sidebar-bottom stack">
        <p className="small muted">{isAdmin ? 'Admin pengelola' : 'Tenant'}</p>
        <Button variant="outline" onClick={() => void logout()}><LogOut />Keluar</Button>
        {logoutError && <p role="alert">{logoutError}</p>}
      </div>
    </aside>
    <div className="admin-body">
      <header className="admin-topbar">
        <div className="admin-mobile-brand"><Brand /></div>
        <strong className="breadcrumb">{links.find(entry => entry.path === activeSection)?.label ?? 'Kantin Vokasi'}</strong>
        <div className="topbar-actions">
          {userUrl && <a className="link-action" href={userUrl}>Lihat menu<ExternalLink /></a>}
          <Button className="admin-menu-toggle" variant="outline" size="icon" aria-label={'Buka navigasi '+portal}
            onClick={() => setMenuOpen(true)}><MenuIcon /></Button>
        </div>
      </header>
      <main className="admin-main">
        {back && <div className="admin-back">
          <Button asChild variant="secondary">
            <Link href={back.href}><ChevronLeft aria-hidden="true" />{back.label}</Link>
          </Button>
        </div>}
        {!isAdmin && <>
          <div className="inbox-toolbar"><ChatInbox key={actor.id} request={request} side="tenant" /></div>
          <OrderNotifier key={actor.id} actor={actor} />
        </>}
        {children}
      </main>
    </div>
    <Modal open={menuOpen} onOpenChange={setMenuOpen} title="Navigasi" description="Kantin Vokasi UI">
      <nav className="admin-nav mobile-admin-nav">{nav()}</nav>
      <Button variant="outline" onClick={() => void logout()}>Keluar</Button>
    </Modal>
  </div>;
}
