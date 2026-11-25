'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Suspense, useState, type ReactNode } from 'react';
import { Brand, Button, ChatInbox, ChevronLeft, ClipboardList, ExternalLink, LayoutDashboard, MapPin, MenuIcon, Modal, Settings2, Store, UtensilsCrossed, LogOut } from '@kantin/ui';
import { ManagementProvider, useManagement } from './management';
import {OrderNotifier} from './order-notifier';
const navigation=[{path:'/',label:'Ringkasan',icon:LayoutDashboard},{path:'/pesanan',label:'Pesanan',icon:ClipboardList},{path:'/menu',label:'Menu & stok',icon:UtensilsCrossed},{path:'/tenant',label:'Tenant',icon:Store,adminOnly:true},{path:'/denah',label:'Denah',icon:MapPin,adminOnly:true},{path:'/akun',label:'Akun & akses',icon:Settings2}];
export function AdminShell({children}:{children:ReactNode}) {return <ManagementProvider><Suspense fallback={<main className="login-page"><p role="status">Memuat pengelola…</p></main>}><Chrome>{children}</Chrome></Suspense></ManagementProvider>;}
function Chrome({children}:{children:ReactNode}) {
  const pathname=usePathname(),router=useRouter();const {actor,loading,error,refreshIdentity,signOut,request}=useManagement();
  const userUrl=process.env.NEXT_PUBLIC_USER_URL??(process.env.NODE_ENV==='development'?'http://localhost:3000':null);
  const [menuOpen,setMenuOpen]=useState(false),[logoutError,setLogoutError]=useState('');
  if(pathname==='/login'||pathname==='/lupa-password')return <>{children}</>;
  if(loading)return <main className="login-page"><section className="panel login-card"><Brand/><p role="status">Memeriksa akses pengelola…</p></section></main>;
  if(!actor)return <main className="login-page"><section className="panel login-card stack"><Brand/><h1>Masuk ke pengelola</h1><p role="alert">{error||'Silakan masuk untuk melanjutkan.'}</p><Button asChild><Link href="/login">Ke halaman masuk</Link></Button><Button variant="outline" onClick={()=>void refreshIdentity()}>Coba kembali</Button></section></main>;
  const isAdmin = actor.role === 'admin_pengelola';
  const tenantDetail = pathname.startsWith('/tenant/');
  const activeSection = tenantDetail ? (isAdmin ? '/tenant' : '/menu') : pathname;
  const links = navigation.filter(entry => isAdmin || !entry.adminOnly);
  const forbidden = !isAdmin && ['/tenant','/denah'].includes(pathname);
  const back = pathname === '/' ? null : tenantDetail
    ? isAdmin
      ? { href:'/tenant', label:'Kembali ke daftar tenant' }
      : { href:'/menu', label:'Kembali ke Menu & stok' }
    : { href:'/', label:'Kembali ke Ringkasan' };

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
      <Link href="/" aria-label="Kantin Vokasi, ringkasan"><Brand /></Link>
      <nav className="admin-nav" aria-label="Navigasi pengelola">{nav()}</nav>
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
          <Button className="admin-menu-toggle" variant="outline" size="icon" aria-label="Buka navigasi pengelola"
            onClick={() => setMenuOpen(true)}><MenuIcon /></Button>
        </div>
      </header>
      <main className="admin-main">
        {back && <div className="admin-back">
          <Button asChild variant="secondary">
            <Link href={back.href}><ChevronLeft aria-hidden="true" />{back.label}</Link>
          </Button>
        </div>}
        {!isAdmin && <div className="inbox-toolbar"><ChatInbox key={actor.id} request={request} side="tenant" /></div>}
        <OrderNotifier key={actor.id} actor={actor} />
        {forbidden ? <section className="panel">
          <h1>Akses khusus admin</h1><p>Akun tenant mengelola menu dan stok miliknya.</p>
        </section> : children}
      </main>
    </div>
    <Modal open={menuOpen} onOpenChange={setMenuOpen} title="Navigasi" description="Kantin Vokasi UI">
      <nav className="admin-nav mobile-admin-nav">{nav()}</nav>
      <Button variant="outline" onClick={() => void logout()}>Keluar</Button>
    </Modal>
  </div>;
}
