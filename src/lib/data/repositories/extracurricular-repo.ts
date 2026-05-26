import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/db/client';
import type { Extracurricular } from '@config/types';

async function loadExtracurriculars(): Promise<Extracurricular[]> {
  // ORDER BY categoryOrder (wajib first, then olahraga/seni/akademik/keagamaan/lainnya)
  // + intra-category order. Static config order vs alphabetical-by-category differs.
  const rows = await prisma.extracurricular.findMany({
    orderBy: [{ categoryOrder: 'asc' }, { order: 'asc' }],
  });
  return rows.map((r) => {
    const base: Extracurricular = {
      id: r.id, name: r.name, category: r.category as Extracurricular['category'],
      description: r.description, pembina: r.pembina, schedule: r.schedule, icon: r.icon,
    };
    if (r.achievement) base.achievement = r.achievement;
    return base;
  });
}

export const getExtracurriculars = unstable_cache(
  loadExtracurriculars, ['extracurriculars'], { tags: ['extracurriculars'] },
);
