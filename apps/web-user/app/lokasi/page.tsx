'use client';
import { Badge, Clock3, MapPin, Store, UtensilsCrossed } from '@kantin/ui';
import { useDemo } from '@kantin/ui/demo';
export default function LocationPage() {
  const { tenants } = useDemo();
  return <>
    <div className="page-intro"><div><div className="eyebrow">LOKASI / KANTIN VOKASI UI</div><h1>Lokasi kantin</h1><p>Lihat posisi tenant dan area makan pada denah contoh.</p></div><Badge>Denah ilustrasi</Badge></div>
    <div className="location-grid"><section className="panel"><div className="panel-header"><h2>Denah kantin fakultas</h2><span className="small muted">Contoh tata letak</span></div>
      <div className="floor-map" role="img" aria-label="Denah contoh: Warung Bu Sari di sisi kiri pintu masuk, area makan di tengah. Posisi sebenarnya belum diisi.">
        <div className="map-building active"><Store /><strong>{tenants[0]?.name}</strong><Badge tone="success">Tenant awal</Badge></div><div className="map-building"><Store /><span>Area tenant berikutnya</span></div>
        <div className="map-path"><Arrow />Jalur masuk kantin<Arrow /></div>
        <div className="map-table"><UtensilsCrossed />Area makan bersama</div><div className="map-table"><UtensilsCrossed />Area makan bersama</div>
      </div><p className="small muted" style={{ marginTop: 'var(--s4)' }}>Posisi di atas hanya ilustrasi. Denah asli dapat ditambahkan pengelola nanti.</p>
    </section><aside className="stack"><section className="panel"><h2>Informasi kantin</h2><div className="settings-list" style={{ marginTop: 'var(--s5)' }}><div className="settings-row"><div><strong className="row"><MapPin />Kantin Fakultas</strong><p>Lokasi lengkap akan dilengkapi pengelola.</p></div></div><div className="settings-row"><div><strong className="row"><Clock3 />08.00–16.00</strong><p>Jam operasional contoh, Senin–Jumat.</p></div></div></div></section>
      <section className="panel"><h2>Tenant tersedia</h2>{tenants.filter((tenant) => tenant.is_active).map((tenant) => <div className="tenant-detail" style={{ marginTop: 'var(--s5)', marginBottom: 0 }} key={tenant.id}><span className="tenant-avatar">BS</span><div><h3>{tenant.name}</h3><p>{tenant.tagline}</p></div></div>)}</section></aside></div>
  </>;
}
function Arrow() { return <span aria-hidden="true">↑</span>; }
