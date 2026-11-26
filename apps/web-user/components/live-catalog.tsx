'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { CatalogStockResponseSchema, TenantListResponseSchema, ManagedMenusResponseSchema } from '@kantin/shared';
import { Button } from '@kantin/ui';
import { DemoProvider, type DemoMenu, type DemoTenant } from '@kantin/ui/demo';

type Catalog = { tenants:DemoTenant[]; menus:DemoMenu[] };
const emptyCatalog: Catalog = { tenants:[], menus:[] };
const refreshInterval = 15000;
const StatusContext = createContext<{
  loading:boolean; error:string; stale:boolean; retry:()=>void;
} | null>(null);

export function useCatalogStatus() {
  return useContext(StatusContext);
}

function isCatalogPage(path: string) {
  return path === '/' || path === '/checkout' || path.startsWith('/tenant/');
}

export function CatalogContent({ children }: { children:ReactNode }) {
  const path = usePathname();
  const state = useCatalogStatus();
  const catalogPage = isCatalogPage(path);
  const required = catalogPage || path === '/lokasi';
  if (required && state && (state.loading || state.error)) {
    return <section className="panel stack">
      <p role={state.error ? 'alert' : 'status'}>{state.error || 'Memuat menu…'}</p>
      {state.error && <Button variant="outline" onClick={state.retry}>Coba kembali</Button>}
    </section>;
  }
  return <>
    {catalogPage && state?.stale && <div className="notice row wrap">
      <p className="small" role="status">Stok terbaru belum dapat dimuat. Jumlah akan diperiksa saat checkout.</p>
      <Button size="sm" variant="outline" onClick={state.retry}>Coba lagi</Button>
    </div>}
    {children}
  </>;
}

export async function pages<T>(
  base:string, path:string, schema:{parse:(value:unknown)=>{data:T[];next_cursor:string|null}}, signal:AbortSignal,
): Promise<T[]> {
  const rows:T[] = [];
  let cursor:string|null = null;
  for (let page = 0; page < 100; page++) {
    const response = await fetch(base + path + '?limit=100' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''), {
      signal, cache:'no-store',
    });
    if (!response.ok) throw new Error('Menu belum dapat dimuat. Silakan coba lagi.');
    const payload:unknown = await response.json();
    const result = schema.parse(payload);
    rows.push(...result.data);
    cursor = result.next_cursor;
    if (!cursor) return rows;
  }
  throw new Error('Daftar menu belum dapat dimuat seluruhnya.');
}

function catalogApiUrl() {
  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
  if (!base) throw new Error('Menu belum tersedia. Silakan coba lagi nanti.');
  return base;
}

async function loadCatalog(signal: AbortSignal): Promise<Catalog> {
  const base = catalogApiUrl();
  const tenants = await pages(base,'/api/tenants',TenantListResponseSchema,signal);
  const menus:DemoMenu[] = [];
  for (let index = 0; index < tenants.length; index += 5) {
    const batches = await Promise.all(tenants.slice(index,index + 5).map(tenant =>
      pages(base,'/api/tenants/' + tenant.id + '/menus',ManagedMenusResponseSchema,signal),
    ));
    for (const batch of batches) {
      menus.push(...batch.map(menu => ({
        ...menu,image:menu.photo_url ?? '/food/fallback.svg',popular:false,spicy:false,
        is_available:menu.is_available && menu.stock > 0,
      })));
    }
  }
  return { menus, tenants:tenants.map(tenant=>({...tenant,email:'',tagline:tenant.description})) };
}

export function LiveCatalog({ children, epoch }: { children:ReactNode; epoch:number }) {
  const path = usePathname();
  const [catalog, setCatalog] = useState<Catalog|null>(null);
  const [result, setResult] = useState({ revision:-1, error:'' });
  const [stale, setStale] = useState(false);
  const [revision, setRevision] = useState(0);
  const settled = result.revision === revision;
  const autoRefresh = isCatalogPage(path) && catalog !== null && settled;

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(),45000);
    let active = true;
    void loadCatalog(controller.signal).then(value => {
      if (!active) return;
      setCatalog(value);
      setResult({ revision,error:'' });
      setStale(false);
    }).catch(() => {
      if (active) setResult({ revision,error:'Menu belum dapat dimuat. Silakan coba lagi.' });
    }).finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [revision]);

  useEffect(() => {
    if (!autoRefresh) return;
    let active = true;
    let pending:AbortController|null = null;

    async function refreshStock() {
      if (!active || document.hidden || pending) return;
      const controller = new AbortController();
      pending = controller;
      const timeout = setTimeout(() => controller.abort(),12000);
      try {
        const rows = await pages(catalogApiUrl(),'/api/catalog/stock',CatalogStockResponseSchema,controller.signal);
        if (!active) return;
        const stock = new Map(rows.map(row => [row.id,row]));
        setCatalog(current => {
          if (!current) return current;
          let changed = false;
          const menus = current.menus.map(menu => {
            const row = stock.get(menu.id);
            const is_active = Boolean(row);
            const is_available = Boolean(row?.is_available);
            const quantity = row?.stock ?? 0;
            if (menu.is_active === is_active && menu.is_available === is_available && menu.stock === quantity) return menu;
            changed = true;
            return { ...menu,is_active,is_available,stock:quantity };
          });
          return changed ? { ...current,menus } : current;
        });
        setStale(false);
      } catch {
        if (active) setStale(true);
      } finally {
        clearTimeout(timeout);
        pending = null;
      }
    }

    const sync = () => void refreshStock();
    const timer = setInterval(sync,refreshInterval);
    document.addEventListener('visibilitychange',sync);
    window.addEventListener('focus',sync);
    return () => {
      active = false;
      clearInterval(timer);
      pending?.abort();
      document.removeEventListener('visibilitychange',sync);
      window.removeEventListener('focus',sync);
    };
  }, [autoRefresh, revision]);

  return <DemoProvider key={epoch} surface="user" catalog={catalog ?? emptyCatalog} persistCart>
    <StatusContext.Provider value={{
      loading:catalog === null && !settled,
      error:catalog === null && settled ? result.error : '',
      stale:stale || Boolean(catalog && settled && result.error),
      retry:()=>setRevision(value=>value+1),
    }}>{children}</StatusContext.Provider>
  </DemoProvider>;
}
