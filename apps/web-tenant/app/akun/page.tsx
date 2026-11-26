'use client';

import Link from 'next/link';
import { Button } from '@kantin/ui';
import { useManagement } from '@kantin/staff/management';

export default function TenantAccountPage() {
  const { actor } = useManagement();
  return <section className="panel stack">
    <h1>Akun saya</h1>
    <p>{actor?.email}</p>
    <div className="form-actions"><Button asChild variant="outline">
      <Link href="/login">Ubah password</Link>
    </Button></div>
  </section>;
}
