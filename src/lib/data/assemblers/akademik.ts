// See header note in assemblers/home.ts about Phase 1 type-cast safety.
import { getPageSections } from '../repositories/page-section-repo';
import { getSubjectGroupsByGrade } from '../repositories/subject-repo';
import type {
  AcademicPageConfig, PageHeaderConfig, KurikulumConfig,
  ScheduleCard, MethodCard, AssessmentCard, CalendarEvent,
  CtaFinal, SectionMeta,
} from '@config/types';

type MapelMetaSection = { meta: SectionMeta };
type JadwalSection = { meta: SectionMeta; cards: ScheduleCard[]; note: string };
type MetodeSection = { meta: SectionMeta; cards: MethodCard[] };
type PenilaianSection = { meta: SectionMeta; intro: string; cards: AssessmentCard[] };
type KalenderMetaSection = {
  meta: SectionMeta; events: CalendarEvent[];
  downloadLabel: string; downloadHref: string;
};

export async function assembleAcademic(): Promise<AcademicPageConfig> {
  const [sections, g7, g8, g9] = await Promise.all([
    getPageSections('akademik'),
    getSubjectGroupsByGrade(7),
    getSubjectGroupsByGrade(8),
    getSubjectGroupsByGrade(9),
  ]);

  const pageHeader = sections.pageHeader as PageHeaderConfig;
  const kurikulum = sections.kurikulum as KurikulumConfig;
  const mapelMeta = sections.mapelMeta as MapelMetaSection;
  const jadwal = sections.jadwal as JadwalSection;
  const metode = sections.metode as MetodeSection;
  const penilaian = sections.penilaian as PenilaianSection;
  const kalenderMeta = sections.kalenderMeta as KalenderMetaSection;
  const ctaFinal = sections.ctaFinal as CtaFinal;

  return {
    pageHeader,
    kurikulum,
    mapel: {
      meta: mapelMeta.meta,
      tabs: [
        { id: 'kelas7', label: 'Kelas 7', groups: g7 },
        { id: 'kelas8', label: 'Kelas 8', groups: g8 },
        { id: 'kelas9', label: 'Kelas 9', groups: g9 },
      ],
    },
    jadwal,
    metode,
    penilaian,
    kalender: {
      meta: kalenderMeta.meta,
      events: kalenderMeta.events,
      downloadLabel: kalenderMeta.downloadLabel,
      downloadHref: kalenderMeta.downloadHref,
    },
    ctaFinal,
  };
}
