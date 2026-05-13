import type { SiteConfig } from './types';
import { navigation } from './navigation';

export const siteConfig: SiteConfig = {
  brand: {
    name: 'SMPN 3 Kresek',
    shortName: 'S3K',
    location: 'Kab. Tangerang, Banten',
    tagline:
      'Membentuk generasi yang cerdas, berkarakter, dan berprestasi untuk masa depan Indonesia yang gemilang.',
    logoMark: 'S3K',
  },
  navigation,
  ppdbCta: { label: 'Info PPDB', href: '/kontak' },
  contact: {
    // TODO: replace with real data
    address: 'Jl. Raya Kresek No. 15, Kresek, Tangerang, Banten 15620',
    // TODO: replace with real data
    addressLines: ['Jl. Raya Kresek No. 15', 'Kresek, Tangerang, Banten 15620'],
    // TODO: replace with real data
    phone: '(021) 5922-1234',
    // TODO: replace with real data
    phoneHref: 'tel:+62215922-1234',
    // TODO: replace with real data — international format without "+"
    whatsapp: '6221592212345',
    // TODO: replace with real data
    email: 'info@smpn3kresek.sch.id',
    hours: 'Senin – Jumat, 07.00 – 15.00 WIB',
    hoursDetail: 'Tutup pada hari Sabtu, Minggu, dan libur nasional',
    // TODO: replace with school coordinates
    mapsUrl: 'https://maps.google.com',
    directionsUrl: 'https://maps.google.com/dir',
  },
  social: [
    {
      platform: 'instagram',
      url: 'https://instagram.com',
      handle: '@smpn3kresek',
      icon: '📷',
      cta: 'Ikuti',
    },
    {
      platform: 'facebook',
      url: 'https://facebook.com',
      handle: 'SMPN 3 Kresek',
      icon: '📘',
      cta: 'Like Page',
    },
    {
      platform: 'youtube',
      url: 'https://youtube.com',
      handle: 'SMPN 3 Kresek Official',
      icon: '▶️',
      cta: 'Subscribe',
    },
    {
      platform: 'tiktok',
      url: 'https://tiktok.com',
      handle: '@smpn3kresek',
      icon: '🎵',
      cta: 'Ikuti',
    },
  ],
  accreditation: {
    // TODO: confirm real grade
    grade: 'A',
    body: 'BAN-S/M',
    label: 'Terakreditasi BAN-S/M',
  },
  footer: {
    copyright: '© 2025 SMPN 3 Kresek — Kab. Tangerang, Banten. Hak cipta dilindungi.',
    designedBy: 'Dirancang oleh Tim PKM — Program Pengabdian kepada Masyarakat',
  },
};
