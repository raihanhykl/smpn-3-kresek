import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/db/client';
import type { Extracurricular } from '@config/types';
import { EKSKUL_CATEGORY_ORDER } from '@config/category-order';
import { photoFromRow, photoToColumns } from './_photo-columns';

type ExtracurricularRow = {
  id: string; name: string; category: string; description: string;
  pembina: string; schedule: string; achievement: string | null;
  photoKind: string; photoSrc: string | null; photoAlt: string | null;
  photoFrom: string | null; photoTo: string | null; photoEmoji: string | null;
};

function rowToExtracurricular(r: ExtracurricularRow): Extracurricular {
  const base: Extracurricular = {
    id: r.id, name: r.name, category: r.category as Extracurricular['category'],
    description: r.description, pembina: r.pembina, schedule: r.schedule,
    photo: photoFromRow('Extracurricular', r.id, r),
  };
  if (r.achievement) base.achievement = r.achievement;
  return base;
}

async function loadExtracurriculars(): Promise<Extracurricular[]> {
  const rows = await prisma.extracurricular.findMany({
    orderBy: [{ categoryOrder: 'asc' }, { order: 'asc' }],
  });
  return rows.map(rowToExtracurricular);
}

export const getExtracurriculars = unstable_cache(
  loadExtracurriculars, ['extracurriculars'], { tags: ['extracurriculars'] },
);

export async function getExtracurricularById(id: string): Promise<Extracurricular | null> {
  const row = await prisma.extracurricular.findUnique({ where: { id } });
  return row ? rowToExtracurricular(row) : null;
}

export type ExtracurricularInput = Omit<Extracurricular, 'id'>;

function inputToColumns(input: ExtracurricularInput) {
  return {
    name: input.name,
    category: input.category,
    categoryOrder: EKSKUL_CATEGORY_ORDER[input.category],
    description: input.description,
    pembina: input.pembina,
    schedule: input.schedule,
    achievement: input.achievement ?? null,
    ...photoToColumns(input.photo),
  };
}

export async function createExtracurricular(input: ExtracurricularInput): Promise<Extracurricular> {
  const max = await prisma.extracurricular.aggregate({
    where: { category: input.category },
    _max: { order: true },
  });
  const order = (max._max.order ?? -1) + 1;
  const row = await prisma.extracurricular.create({
    data: { ...inputToColumns(input), order },
  });
  return rowToExtracurricular(row);
}

export async function updateExtracurricular(id: string, input: ExtracurricularInput): Promise<Extracurricular> {
  const row = await prisma.extracurricular.update({
    where: { id },
    data: inputToColumns(input),
  });
  return rowToExtracurricular(row);
}

export async function deleteExtracurricular(id: string): Promise<void> {
  await prisma.extracurricular.delete({ where: { id } });
}

/**
 * Reorder per-category (display order is `[categoryOrder, order]`), so a flat
 * global index would clash across categories. Same approach as reorderTeachers.
 */
export async function reorderExtracurriculars(orderedIds: string[]): Promise<void> {
  const rows = await prisma.extracurricular.findMany({
    where: { id: { in: orderedIds } },
    select: { id: true, category: true },
  });
  const categoryById = new Map(rows.map((r) => [r.id, r.category]));
  const perCategoryCounter = new Map<string, number>();
  const updates = orderedIds
    .filter((id) => categoryById.has(id))
    .map((id) => {
      const cat = categoryById.get(id)!;
      const next = perCategoryCounter.get(cat) ?? 0;
      perCategoryCounter.set(cat, next + 1);
      return prisma.extracurricular.update({ where: { id }, data: { order: next } });
    });
  await prisma.$transaction(updates);
}
