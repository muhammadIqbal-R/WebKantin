'use client';
import { useState } from 'react';
import { UploadMetadataSchema } from '@kantin/shared';
import { Badge, Button, EmptyState, FoodPhoto, ImagePlus, MapPin, Store, UtensilsCrossed } from '@kantin/ui';
import { useDemo } from '@kantin/ui/demo';
export default function MapPage() {
  const { role, tenants, notify } = useDemo();
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  if (role === 'tenant') return <div className="panel"><EmptyState icon={<MapPin />} title="Denah dikelola Admin Pengelola" description="Informasi lokasi tetap bisa dilihat pada web pemesan." /></div>;
  return <><div className="page-intro"><div><div className="eyebrow text-action">LOKASI & DENAH</div><h1 style={{ marginTop: 'var(--s2)' }}>Denah kantin</h1><p>Bantu pemesan menemukan tenant dan area makan.</p></div><Badge>1 outlet · Kantin Fakultas</Badge></div>
    <div className="location-grid"><section className="panel"><div className="panel-header"><h2>Preview denah</h2><Badge>{preview ? 'Gambar lokal' : 'Ilustrasi'}</Badge></div>
      {preview ? <div className="floor-map" style={{ display: 'block' }}><FoodPhoto src={preview} alt="Preview denah lokal yang dipilih" /></div> : <div className="floor-map" role="img" aria-label="Ilustrasi denah: tenant awal di kiri, area tenant baru di kanan, jalur masuk dan meja makan di tengah."><div className="map-building active"><Store /><strong>{tenants[0]?.name}</strong><span>Tenant awal</span></div><div className="map-building"><Store />Area tenant baru</div><div className="map-path">↑ Jalur masuk kantin ↑</div><div className="map-table"><UtensilsCrossed />Area makan</div><div className="map-table"><UtensilsCrossed />Area makan</div></div>}
    </section><section className="panel"><h2>Perbarui gambar</h2><p className="small muted" style={{ marginTop: 'var(--s2)', marginBottom: 'var(--s5)' }}>Gambar hanya dipreview lokal. Belum ada upload atau perubahan denah pada web pemesan.</p>
      <label className="upload-box"><span><strong className="row"><ImagePlus />Pilih gambar denah</strong><p className="small muted">JPG, PNG, WebP · maksimal 2 MiB</p><input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Pilih gambar denah" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; if (!UploadMetadataSchema.safeParse({ mime_type: file.type, size_bytes: file.size }).success) { setError('Pilih JPG, PNG, atau WebP dengan ukuran maksimal 2 MiB.'); return; } setPreview(URL.createObjectURL(file)); setError(''); notify('Preview denah lokal diperbarui.'); }} /></span></label>
      {error ? <p className="form-error" role="alert" style={{ marginTop: 'var(--s4)' }}>{error}</p> : null}
      {preview ? <Button className="full" variant="outline" style={{ marginTop: 'var(--s4)' }} onClick={() => setPreview('')}>Kembali ke denah ilustrasi</Button> : null}
      <div className="settings-list" style={{ marginTop: 'var(--s6)' }}><div className="settings-row"><div><strong>Kantin Fakultas</strong><p>Nama lokasi contoh</p></div><MapPin /></div><div className="settings-row"><div><strong>{tenants.length} tenant</strong><p>Dalam satu lokasi kantin</p></div><Store /></div></div></section></div></>;
}
