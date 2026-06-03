// Section TEXT from config (src/config/pages/fasilitas.ts). Entities (extracurriculars,
// gallery, facilities) + the tata-tertib DocumentSlot still merged from the DB. No
// admin-editable section photos on this page.
import { fasilitasPageConfig } from '@config/pages/fasilitas';
import { getExtracurriculars } from '../repositories/extracurricular-repo';
import { getAllGalleryItems } from '../repositories/gallery-repo';
import { getFacilitiesGrouped } from '../repositories/facility-repo';
import { getDocumentSlotWithMedia } from '../repositories/document-slot-repo';
import type { FacilitiesPageConfig } from '@config/types';

export async function assembleFacilities(): Promise<FacilitiesPageConfig> {
  const c = fasilitasPageConfig;
  const [ekskul, gallery, fac, tatibSlot] = await Promise.all([
    getExtracurriculars(),
    getAllGalleryItems(),
    getFacilitiesGrouped(),
    getDocumentSlotWithMedia('tata-tertib'),
  ]);

  return {
    ...c,
    pageHeader: c.pageHeader,
    sarana: {
      meta: c.sarana.meta,
      statStrip: c.sarana.statStrip,
      featured: fac.featured,
      mini: fac.mini,
    },
    ekskul: {
      meta: c.ekskul.meta,
      statStrip: c.ekskul.statStrip,
      filterLabels: c.ekskul.filterLabels,
      items: ekskul,
    },
    kegiatan: c.kegiatan,
    galeri: {
      meta: c.galeri.meta,
      filterLabels: c.galeri.filterLabels,
      items: gallery,
    },
    tatib: {
      meta: c.tatib.meta,
      accordions: c.tatib.accordions,
      documentSlot: tatibSlot
        ? { id: tatibSlot.id, media: tatibSlot.media ? {
            id: tatibSlot.media.id,
            kind: tatibSlot.media.kind,
            publicId: tatibSlot.media.publicId,
            filename: tatibSlot.media.filename,
            sizeBytes: tatibSlot.media.sizeBytes,
            alt: tatibSlot.media.alt,
          } : null }
        : null,
    },
    ctaFinal: c.ctaFinal,
  };
}
