'use client';

import { useEffect, useState } from 'react';
import { Button } from './primitives';

export function FloorMap({ name, load }: { name: string; load: () => Promise<string> }) {
  const [revision, setRevision] = useState(0);
  const [image, setImage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void load().then(url => {
      if (active) setImage(url);
    }).catch(() => {
      if (active) setFailed(true);
    });
    return () => { active = false; };
  }, [load, revision]);

  if (failed) return <div className="stack">
    <p role="alert">Denah belum dapat dimuat.</p>
    <Button variant="outline" onClick={() => {
      setFailed(false);
      setImage(null);
      setRevision(value => value + 1);
    }}>Muat ulang denah</Button>
  </div>;

  if (!image) return <p role="status">Memuat denah…</p>;
  return <a className="floor-map stack" href={image} target="_blank" rel="noopener noreferrer">
    <img src={image} alt={'Denah ' + name} onError={() => setFailed(true)} />
    <span className="link-action">Buka denah ukuran penuh</span>
  </a>;
}
