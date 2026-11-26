'use client';

import Link from 'next/link';
import { Brand, PasswordRecovery } from '@kantin/ui';
import { recoveryAuth } from './supabase';

export function StaffPasswordRecovery() {
  return <main className="login-page"><section className="panel login-card stack">
    <Brand />
    <PasswordRecovery client={recoveryAuth} back={<Link className="link-action" href="/login">Kembali ke halaman masuk</Link>} />
  </section></main>;
}
