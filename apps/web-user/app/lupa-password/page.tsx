'use client';

import Link from 'next/link';
import { PasswordRecovery } from '@kantin/ui';
import { recoveryAuth } from '../../lib/supabase';

export default function RecoveryPage() {
  return <section className="panel stack">
    <PasswordRecovery client={recoveryAuth} back={<Link className="link-action" href="/masuk">Kembali ke halaman masuk</Link>} />
  </section>;
}
