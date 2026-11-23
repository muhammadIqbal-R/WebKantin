import localFont from 'next/font/local';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { AdminShell } from '../components/admin-shell';
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
export const metadata: Metadata = { title: 'Pengelola — Kantin Vokasi UI', description: 'Pengelolaan tenant, menu, stok, dan akses kantin.' };
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="id" className={poppins.variable}><body className="management-app"><AdminShell>{children}</AdminShell></body></html>;
}
