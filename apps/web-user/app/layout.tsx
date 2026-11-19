import localFont from 'next/font/local';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { CustomerAuthProvider } from '../components/customer-auth';
import { UserShell } from '../components/user-shell';
import { Analytics } from '@vercel/analytics/next';

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
export const metadata: Metadata = { title: 'Kantin Vokasi UI — Menu hari ini', description: 'Pilih menu favorit, pesan, dan ambil di kantin fakultas. Pratinjau dengan data contoh.' };
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" className={poppins.variable}>
      <body className="customer-app">
        <CustomerAuthProvider>
          <UserShell>{children}</UserShell>
        </CustomerAuthProvider>
        <Analytics />
      </body>
    </html>
  );
}