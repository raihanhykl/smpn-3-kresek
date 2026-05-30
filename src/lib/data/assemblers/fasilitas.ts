// See header note in assemblers/home.ts about Phase 1 type-cast safety.
import { getPageSections } from '../repositories/page-section-repo';
import { getExtracurriculars } from '../repositories/extracurricular-repo';
import { getAllGalleryItems } from '../repositories/gallery-repo';
import { getFacilitiesGrouped } from '../repositories/facility-repo';
import { getDocumentSlotWithMedia } from '../repositories/document-slot-repo';
import type {
  FacilitiesPageConfig, PageHeaderConfig, KegiatanCard,
  AccordionContent, CtaFinal, SectionMeta,
} from '@config/types';

type SaranaMetaSection = { meta: SectionMeta; statStrip: { value: string; label: string }[] };
type EkskulMetaSection = {
  meta: SectionMeta;
  statStrip: { value: string; label: string }[];
  filterLabels: FacilitiesPageConfig['ekskul']['filterLabels'];
};
type KegiatanSection = { meta: SectionMeta; cards: KegiatanCard[] };
type GaleriMetaSection = {
  meta: SectionMeta;
  filterLabels: FacilitiesPageConfig['galeri']['filterLabels'];
};
// Phase 3: tatib no longer carries downloadLabel/downloadHref. The download
// link is sourced from the DocumentSlot at assembler runtime.
type TatibSection = { meta: SectionMeta; accordions: AccordionContent[] };

export async function assembleFacilities(): Promise<FacilitiesPageConfig> {
  const sections = await getPageSections('fasilitas');

  const pageHeader = sections.pageHeader as PageHeaderConfig;
  const saranaMeta = sections.saranaMeta as SaranaMetaSection;
  const ekskulMeta = sections.ekskulMeta as EkskulMetaSection;
  const kegiatan = sections.kegiatan as KegiatanSection;
  const galeriMeta = sections.galeriMeta as GaleriMetaSection;
  const tatib = sections.tatib as TatibSection;
  const ctaFinal = sections.ctaFinal as CtaFinal;

  const [ekskul, gallery, fac, tatibSlot] = await Promise.all([
    getExtracurriculars(),
    getAllGalleryItems(),
    getFacilitiesGrouped(),
    getDocumentSlotWithMedia('tata-tertib'),
  ]);

  return {
    pageHeader,
    sarana: {
      meta: saranaMeta.meta,
      statStrip: saranaMeta.statStrip,
      featured: fac.featured,
      mini: fac.mini,
    },
    ekskul: {
      meta: ekskulMeta.meta,
      statStrip: ekskulMeta.statStrip,
      filterLabels: ekskulMeta.filterLabels,
      items: ekskul,
    },
    kegiatan,
    galeri: {
      meta: galeriMeta.meta,
      filterLabels: galeriMeta.filterLabels,
      items: gallery,
    },
    tatib: {
      meta: tatib.meta,
      accordions: tatib.accordions,
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
    ctaFinal,
  };
}
