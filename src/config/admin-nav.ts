export type AdminNavItem = {
  label: string;
  href: string;
  icon: string; // emoji for now (Phase 5 may swap to icon set)
  /** Which roles see this item. */
  roles: ('ADMIN' | 'EDITOR')[];
};

export type AdminNavGroup = {
  heading: string;
  items: AdminNavItem[];
};

export const adminNav: AdminNavGroup[] = [
  {
    heading: 'Umum',
    items: [
      { label: 'Dashboard', href: '/admin/dashboard', icon: '🏠', roles: ['ADMIN', 'EDITOR'] },
    ],
  },
  {
    heading: 'Konten',
    items: [
      { label: 'Guru & Staf', href: '/admin/entities/teachers', icon: '👩‍🏫', roles: ['ADMIN', 'EDITOR'] },
      { label: 'Struktur Organisasi', href: '/admin/entities/organization', icon: '🗂️', roles: ['ADMIN', 'EDITOR'] },
      { label: 'Prestasi', href: '/admin/entities/achievements', icon: '🏆', roles: ['ADMIN', 'EDITOR'] },
      { label: 'Ekstrakurikuler', href: '/admin/entities/ekskul', icon: '🎯', roles: ['ADMIN', 'EDITOR'] },
      { label: 'Mata Pelajaran', href: '/admin/entities/subjects', icon: '📚', roles: ['ADMIN', 'EDITOR'] },
      { label: 'Fasilitas', href: '/admin/entities/facilities', icon: '🏫', roles: ['ADMIN', 'EDITOR'] },
      { label: 'Galeri', href: '/admin/entities/gallery', icon: '🖼️', roles: ['ADMIN', 'EDITOR'] },
      { label: 'FAQ', href: '/admin/entities/faqs', icon: '❓', roles: ['ADMIN', 'EDITOR'] },
      { label: 'Media', href: '/admin/media', icon: '📷', roles: ['ADMIN', 'EDITOR'] },
    ],
  },
];
