import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Plus_Jakarta_Sans, Inter } from 'next/font/google';
import '../styles/globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SMPN 3 Kresek',
  description:
    'Website resmi SMP Negeri 3 Kresek, Kabupaten Tangerang, Banten — sekolah modern dengan Kurikulum Merdeka, fasilitas lengkap, dan ekstrakurikuler beragam.',
  metadataBase: new URL('https://smpn3kresek.sch.id'),
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" className={`${jakarta.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
