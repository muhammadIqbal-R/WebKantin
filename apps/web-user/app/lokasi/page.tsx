'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { FloorMapResponseSchema, OutletListResponseSchema, TenantListResponseSchema, type Outlet, type Tenant } from '@kantin/shared';
import { Button, FloorMap, Store } from '@kantin/ui';
import { pages } from '../../components/live-catalog';

const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');

export default function LocationPage() {
  const [outlets, setOutlets] = useState<Outlet[] | null>(null);
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let active = true;
    async function load() {
      if (!base) throw new Error('API URL missing');
      const data = await pages(base, '/api/outlets', OutletListResponseSchema, controller.signal);
      if (active) setOutlets(data);
      if (!data.length) return;
      const sellers = await pages(base, '/api/tenants', TenantListResponseSchema, controller.signal);
      if (active) setTenants(sellers);
    }
    void load().catch(() => { if (active) setFailed(true); }).finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [revision]);

  return <>
    <div className="page-intro"><h1>Lokasi kantin</h1></div>
    {failed && <section className="panel stack">
      <p role="alert">Informasi lokasi belum dapat dimuat seluruhnya.</p>
      <Button variant="outline" onClick={() => { setFailed(false); setRevision(value => value + 1); }}>Coba kembali</Button>
    </section>}
    {!outlets && !failed && <p role="status">Memuat lokasi…</p>}
    {outlets?.length === 0 && <section className="panel"><p>Lokasi belum ditambahkan pengelola.</p></section>}
    {outlets?.map(outlet => {
      const sellers = tenants?.filter(tenant => tenant.outlet_id === outlet.id);
      return <section className="panel stack" key={outlet.id}>
        <h2>{outlet.name}</h2>
        <p>{outlet.location}</p>
        {outlet.floor_map_url
          ? <MapImage key={outlet.floor_map_url} outlet={outlet} />
          : <p className="muted">Denah belum ditambahkan.</p>}
        {sellers?.map(tenant => <div className="settings-row" key={tenant.id}>
          <strong className="row"><Store />{tenant.name}</strong>
          <Button asChild variant="outline" size="sm"><Link href={'/tenant/' + tenant.id}>Lihat menu</Link></Button>
        </div>)}
        {sellers?.length === 0 && <p className="small muted">Belum ada tenant aktif di lokasi ini.</p>}
      </section>;
    })}
  </>;
}

function MapImage({ outlet }: { outlet: Outlet }) {
  const load = useCallback(async () => {
    const response = await fetch(base + '/api/outlets/' + outlet.id + '/floor-map', {
      cache: 'no-store', signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error('Map request failed');
    return FloorMapResponseSchema.parse(await response.json()).image_url;
  }, [outlet.id]);
  return <FloorMap name={outlet.name} load={load} />;
}
