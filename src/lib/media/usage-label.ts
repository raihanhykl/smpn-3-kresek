export type UsageRow = { usedInTable: string; usedInId: string; usedInField: string };

const TABLE_LABELS: Record<string, string> = {
  Teacher: 'Guru',
  Achievement: 'Prestasi',
  Extracurricular: 'Ekstrakurikuler',
  GalleryItem: 'Galeri',
  Facility: 'Fasilitas',
  Mading: 'Mading',
  DocumentSlot: 'Dokumen',
};

// SectionPhoto slot key (`${pageKey}:${sectionKey}:${field}`) → human name.
// Disambiguated per field where a section owns more than one photo (about), so
// two distinct slots never collapse to the same label.
const SECTION_LABELS: Record<string, string> = {
  'home:hero:photo': 'Hero Beranda',
  'home:sambutan:photo': 'Foto Kepala Sekolah',
  'home:about:photoMain': 'Tentang Kami (foto utama)',
  'home:about:photoSub': 'Tentang Kami (foto pendukung)',
  'profil:sejarah:photo': 'Sejarah',
  'akademik:kurikulum:photo': 'Kurikulum',
};

/** Friendly Indonesian label for a single MediaUsage row. */
export function usageLabel(row: UsageRow): string {
  if (row.usedInTable === 'SectionPhoto') {
    return SECTION_LABELS[row.usedInId] ?? `Halaman (${row.usedInId})`;
  }
  return TABLE_LABELS[row.usedInTable] ?? row.usedInTable;
}
