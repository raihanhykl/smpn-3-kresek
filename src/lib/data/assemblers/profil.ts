// See header note in assemblers/home.ts about Phase 1 type-cast safety.
import { getPageSections } from '../repositories/page-section-repo';
import { getTeachers } from '../repositories/teacher-repo';
import { getAchievementsByIds } from '../repositories/achievement-repo';
import { getOrganizationChart } from '../repositories/organization-repo';
import type {
  ProfilePageConfig, PageHeaderConfig, VisiMisiConfig,
  ObjectiveCard, IdentityRow, CtaFinal, SectionMeta,
} from '@config/types';

type SejarahSection = ProfilePageConfig['sejarah'];
type StrukturMetaSection = { meta: SectionMeta; studentNote: string };
type GuruMetaSection = { meta: SectionMeta; filterLabels: ProfilePageConfig['guru']['filterLabels'] };
type PrestasiMetaSection = { meta: SectionMeta; featuredIds: string[] };

export async function assembleProfile(): Promise<ProfilePageConfig> {
  const sections = await getPageSections('profil');

  const pageHeader = sections.pageHeader as PageHeaderConfig;
  const sejarah = sections.sejarah as SejarahSection;
  const visiMisi = sections.visiMisi as VisiMisiConfig;
  const tujuan = sections.tujuan as { meta: SectionMeta; cards: ObjectiveCard[] };
  const identitas = sections.identitas as { meta: SectionMeta; rows: IdentityRow[] };
  const strukturMeta = sections.strukturMeta as StrukturMetaSection;
  const guruMeta = sections.guruMeta as GuruMetaSection;
  const prestasiMeta = sections.prestasiMeta as PrestasiMetaSection;
  const ctaFinal = sections.ctaFinal as CtaFinal;

  // Fetch entities only after we have the IDs needed.
  const [teachers, achievements, chartLevels] = await Promise.all([
    getTeachers(),
    getAchievementsByIds(prestasiMeta.featuredIds),
    getOrganizationChart(),
  ]);

  return {
    pageHeader,
    sejarah,
    visiMisi,
    tujuan,
    identitas,
    struktur: {
      meta: strukturMeta.meta,
      chart: { levels: chartLevels, studentNote: strukturMeta.studentNote },
    },
    guru: {
      meta: guruMeta.meta,
      filterLabels: guruMeta.filterLabels,
      teachers,
    },
    prestasi: { meta: prestasiMeta.meta, items: achievements },
    ctaFinal,
  };
}
