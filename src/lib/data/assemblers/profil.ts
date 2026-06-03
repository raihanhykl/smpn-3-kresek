// Section TEXT from config (src/config/pages/profil.ts). Entity data (teachers,
// achievements, org chart) still merged from the DB. Sejarah's photo is overlaid
// from the SectionPhoto table.
import { profilPageConfig } from '@config/pages/profil';
import { getTeachers } from '../repositories/teacher-repo';
import { getAllAchievements } from '../repositories/achievement-repo';
import { getOrganizationChart } from '../repositories/organization-repo';
import { getAllSectionPhotos, slotKey } from '../repositories/section-photo-repo';
import type { ProfilePageConfig } from '@config/types';

export async function assembleProfile(): Promise<ProfilePageConfig> {
  const c = profilPageConfig;
  const [teachers, achievements, chartLevels, photos] = await Promise.all([
    getTeachers(),
    getAllAchievements(),
    getOrganizationChart(),
    getAllSectionPhotos(),
  ]);

  return {
    ...c,
    pageHeader: c.pageHeader,
    sejarah: { ...c.sejarah, photo: photos[slotKey('profil', 'sejarah', 'photo')] ?? c.sejarah.photo },
    visiMisi: c.visiMisi,
    tujuan: c.tujuan,
    identitas: c.identitas,
    struktur: {
      meta: c.struktur.meta,
      chart: { levels: chartLevels, studentNote: c.struktur.chart.studentNote },
    },
    guru: {
      meta: c.guru.meta,
      filterLabels: c.guru.filterLabels,
      teachers,
    },
    prestasi: { meta: c.prestasi.meta, items: achievements },
    ctaFinal: c.ctaFinal,
  };
}
