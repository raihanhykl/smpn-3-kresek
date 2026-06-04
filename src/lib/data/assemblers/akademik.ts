// Section TEXT from config (src/config/pages/akademik.ts). Subject groups (per
// grade) + the kalender DocumentSlot still merged from the DB. Kurikulum's photo
// is overlaid from the SectionPhoto table.
import { akademikPageConfig } from '@config/pages/akademik';
import { getSubjectGroupsByGrade } from '../repositories/subject-repo';
import { getDocumentSlotWithMedia } from '../repositories/document-slot-repo';
import { getAllSectionPhotos, slotKey } from '../repositories/section-photo-repo';
import type { AcademicPageConfig } from '@config/types';

export async function assembleAcademic(): Promise<AcademicPageConfig> {
  const c = akademikPageConfig;
  const [g7, g8, g9, documentSlot, photos] = await Promise.all([
    getSubjectGroupsByGrade(7),
    getSubjectGroupsByGrade(8),
    getSubjectGroupsByGrade(9),
    getDocumentSlotWithMedia('kalender-akademik'),
    getAllSectionPhotos(),
  ]);

  return {
    ...c,
    pageHeader: c.pageHeader,
    kurikulum: { ...c.kurikulum, photo: photos[slotKey('akademik', 'kurikulum', 'photo')] ?? c.kurikulum.photo },
    mapel: {
      meta: c.mapel.meta,
      tabs: [
        { id: 'kelas7', label: 'Kelas 7', groups: g7 },
        { id: 'kelas8', label: 'Kelas 8', groups: g8 },
        { id: 'kelas9', label: 'Kelas 9', groups: g9 },
      ],
    },
    jadwal: c.jadwal,
    metode: c.metode,
    penilaian: c.penilaian,
    kalender: {
      meta: c.kalender.meta,
      documentSlot: documentSlot
        ? { id: documentSlot.id, media: documentSlot.media ? {
            id: documentSlot.media.id,
            kind: documentSlot.media.kind,
            publicId: documentSlot.media.publicId,
            filename: documentSlot.media.filename,
            sizeBytes: documentSlot.media.sizeBytes,
            alt: documentSlot.media.alt,
          } : null }
        : null,
    },
    ctaFinal: c.ctaFinal,
  };
}
