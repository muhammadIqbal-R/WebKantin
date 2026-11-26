import localFont from 'next/font/local';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { StaffShell } from '@kantin/staff/shell';
import './globals.css';

const poppins = localFont({
  src: [
    { path: '../../../packages/ui/fonts/Poppins-Regular.ttf', weight: '400', style: 'normal' },
    { path: '../../../packages/ui/fonts/Poppins-Medium.ttf', weight: '500', style: 'normal' },
    { path: '../../../packages/ui/fonts/Poppins-SemiBold.ttf', weight: '600', style: 'normal' },
    { path: '../../../packages/ui/fonts/Poppins-Bold.ttf', weight: '700', style: 'normal' },
  ],
  variable: '--font-poppins',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Tenant — Kantin Vokasi UI',
  description: 'Pesanan, pembayaran, dan stok tenant Kantin Vokasi UI.',
};

export default function TenantLayout({ children }: { children: ReactNode }) {
  return <html lang="id" className={poppins.variable}>
    <body className="management-app"><StaffShell role="tenant">{children}</StaffShell></body>
  </html>;
}
