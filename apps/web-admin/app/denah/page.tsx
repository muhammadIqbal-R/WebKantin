'use client';

import { useCallback, useState, type FormEvent } from 'react';
import {
  CreateOutletRequestSchema, FloorMapResponseSchema, OutletListResponseSchema,
  OutletSchema, UpdateOutletRequestSchema, UploadResponseSchema, type Outlet,
} from '@kantin/shared';
import { Badge, Button, Field, FloorMap, Modal } from '@kantin/ui';
import { DataState } from '../../components/data-state';
import { ImageField } from '../../components/image-field';
import { collect, useLoad, useManagement } from '../../components/management';

export default function MapPage() {
  const { request } = useManagement();
  const load = useCallback(() => collect(request, '/api/admin/outlets', OutletListResponseSchema), [request]);
  const state = useLoad(load);
  const [editing, setEditing] = useState<Outlet | 'new' | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  return <>
    <div className="page-intro">
      <h1>Denah kantin</h1>
      <Button onClick={() => { setMessage(''); setEditing('new'); }}>Tambah outlet</Button>
    </div>
    <DataState {...state} retry={state.reload} />
    {message && <p role="status">{message}</p>}
    {!state.loading && !state.error && !state.data?.length && <p>Belum ada outlet.</p>}
    {state.data?.map(outlet => <section className="panel stack" key={outlet.id}>
      <div className="row between wrap">
        <h2>{outlet.name}</h2>
        <Badge tone={outlet.is_active ? 'success' : 'neutral'}>{outlet.is_active ? 'Tampil ke pelanggan' : 'Tersembunyi'}</Badge>
      </div>
      <p>{outlet.location}</p>
      {outlet.floor_map_url
        ? <OutletPreview key={outlet.floor_map_url} outlet={outlet} />
        : <p className="small muted">Belum ada gambar denah.</p>}
      <div><Button variant="outline" onClick={() => { setMessage(''); setEditing(outlet); }}>Edit lokasi dan denah</Button></div>
    </section>)}
    <Modal open={editing !== null} onOpenChange={open => { if (!open && !saving) setEditing(null); }}
      title={editing === 'new' ? 'Tambah outlet' : 'Edit lokasi dan denah'}
      description={editing === 'new' ? 'Simpan lokasi dahulu untuk menambahkan gambar.' : 'Lokasi aktif tampil pada halaman pelanggan.'}>
      {editing && <OutletForm key={editing === 'new' ? 'new' : editing.id} outlet={editing === 'new' ? null : editing}
        saving={saving} setSaving={setSaving} onSaved={async (created) => {
          setEditing(null);
          setMessage(created ? 'Outlet dibuat. Edit outlet untuk menambahkan denah dan mengaktifkannya.' : 'Perubahan disimpan.');
          await state.reload();
        }} />}
    </Modal>
  </>;
}

function OutletPreview({ outlet }: { outlet: Outlet }) {
  const { request } = useManagement();
  const load = useCallback(async () => {
    const response = await request('/api/admin/outlets/' + outlet.id + '/floor-map', FloorMapResponseSchema);
    return response.image_url;
  }, [outlet.id, request]);
  return <FloorMap name={outlet.name} load={load} />;
}

function OutletForm({ outlet, saving, setSaving, onSaved }: {
  outlet: Outlet | null;
  saving: boolean;
  setSaving: (value: boolean) => void;
  onSaved: (created: boolean) => Promise<void>;
}) {
  const { request } = useManagement();
  const [name, setName] = useState(outlet?.name ?? '');
  const [location, setLocation] = useState(outlet?.location ?? '');
  const [active, setActive] = useState(outlet?.is_active ?? false);
  const [file, setFile] = useState<File | null>(null);
  const [remove, setRemove] = useState(false);
  const [error, setError] = useState('');

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const details = CreateOutletRequestSchema.safeParse({ name, location, floor_map_url: null });
    if (!details.success) { setError('Periksa nama outlet dan keterangan lokasi.'); return; }
    setSaving(true);
    setError('');
    try {
      if (!outlet) {
        await request('/api/admin/outlets', OutletSchema, 'POST', details.data);
      } else {
        let floorMapUrl: string | null | undefined = remove ? null : undefined;
        if (file && !remove) {
          const body = new FormData();
          body.append('file', file);
          const result = await request('/api/admin/uploads?purpose=floor_map&owner_id=' + outlet.id,
            UploadResponseSchema, 'POST', body);
          floorMapUrl = result.asset_url;
        }
        const patch = UpdateOutletRequestSchema.parse({
          name: details.data.name, location: details.data.location,
          ...(active !== outlet.is_active ? { is_active: active } : {}),
          ...(floorMapUrl !== undefined ? { floor_map_url: floorMapUrl } : {}),
        });
        await request('/api/admin/outlets/' + outlet.id, OutletSchema, 'PATCH', patch);
      }
      await onSaved(!outlet);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Lokasi belum dapat disimpan.');
    } finally { setSaving(false); }
  }

  return <form className="stack" onSubmit={save}>
    <Field label="Nama outlet"><input className="input" required minLength={2} maxLength={100}
      disabled={saving} value={name} onChange={event => setName(event.target.value)} /></Field>
    <Field label="Keterangan lokasi"><textarea className="textarea" required minLength={2} maxLength={300}
      disabled={saving} value={location} onChange={event => setLocation(event.target.value)} /></Field>
    {outlet && <>
      <ImageField label="Gambar denah baru" current={null} file={file} onChange={setFile} disabled={saving || remove} />
      {outlet.floor_map_url && <label className="row">
        <input type="checkbox" checked={remove} disabled={saving} onChange={event => setRemove(event.target.checked)} />
        Hapus gambar denah
      </label>}
      <label className="row">
        <input type="checkbox" checked={active} disabled={saving} onChange={event => setActive(event.target.checked)} />
        Tampilkan ke pelanggan
      </label>
    </>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <Button type="submit" loading={saving}>{outlet ? 'Simpan perubahan' : 'Simpan outlet'}</Button>
  </form>;
}
