import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/db/client';
import type { Teacher } from '@config/types';

function rowToTeacher(row: {
  id: string; name: string; position: string; badge: string; category: string;
  photoKind: string; photoSrc: string | null; photoAlt: string | null;
  photoFrom: string | null; photoTo: string | null; photoEmoji: string | null;
}): Teacher {
  let photo: Teacher['photo'];
  if (row.photoKind === 'url') {
    if (row.photoSrc === null || row.photoAlt === null) {
      throw new Error(`Teacher ${row.id}: photoKind=url requires photoSrc + photoAlt`);
    }
    photo = { kind: 'url', src: row.photoSrc, alt: row.photoAlt };
  } else if (row.photoKind === 'gradient') {
    if (row.photoFrom === null || row.photoTo === null || row.photoEmoji === null) {
      throw new Error(`Teacher ${row.id}: photoKind=gradient requires photoFrom + photoTo + photoEmoji`);
    }
    photo = { kind: 'gradient', from: row.photoFrom, to: row.photoTo, emoji: row.photoEmoji };
  } else {
    throw new Error(`Teacher ${row.id}: unknown photoKind "${row.photoKind}"`);
  }
  return {
    id: row.id, name: row.name, position: row.position, badge: row.badge,
    category: row.category as Teacher['category'], photo,
  };
}

async function loadTeachers(): Promise<Teacher[]> {
  // ORDER BY categoryOrder (explicit pimpinan-first/guru/tu) + intra-category order.
  // NOT by 'category' alphabetical — that would reorder pimpinan → guru → tu wrong.
  const rows = await prisma.teacher.findMany({
    orderBy: [{ categoryOrder: 'asc' }, { order: 'asc' }],
  });
  return rows.map(rowToTeacher);
}

export const getTeachers = unstable_cache(loadTeachers, ['teachers'], { tags: ['teachers'] });

// Category → explicit display order. Mirror of seed-content's TEACHER_CATEGORY_ORDER.
const TEACHER_CATEGORY_ORDER: Record<Teacher['category'], number> = {
  pimpinan: 0, guru: 1, tu: 2,
};

export type TeacherInput = Omit<Teacher, 'id'>;

function photoToColumns(photo: Teacher['photo']): {
  photoKind: string; photoSrc: string | null; photoAlt: string | null;
  photoFrom: string | null; photoTo: string | null; photoEmoji: string | null;
} {
  if (photo.kind === 'url') {
    return { photoKind: 'url', photoSrc: photo.src, photoAlt: photo.alt, photoFrom: null, photoTo: null, photoEmoji: null };
  }
  return { photoKind: 'gradient', photoSrc: null, photoAlt: null, photoFrom: photo.from, photoTo: photo.to, photoEmoji: photo.emoji };
}

export async function createTeacher(input: TeacherInput): Promise<Teacher> {
  const categoryOrder = TEACHER_CATEGORY_ORDER[input.category];
  const max = await prisma.teacher.aggregate({
    where: { category: input.category },
    _max: { order: true },
  });
  const order = (max._max.order ?? -1) + 1;
  const row = await prisma.teacher.create({
    data: {
      name: input.name, position: input.position, badge: input.badge,
      category: input.category, categoryOrder, order, ...photoToColumns(input.photo),
    },
  });
  return rowToTeacher(row);
}

export async function updateTeacher(id: string, input: TeacherInput): Promise<Teacher> {
  const categoryOrder = TEACHER_CATEGORY_ORDER[input.category];
  const row = await prisma.teacher.update({
    where: { id },
    data: {
      name: input.name, position: input.position, badge: input.badge,
      category: input.category, categoryOrder, ...photoToColumns(input.photo),
    },
  });
  return rowToTeacher(row);
}

export async function deleteTeacher(id: string): Promise<void> {
  await prisma.teacher.delete({ where: { id } });
}

/**
 * Reorder teachers. Teacher display order is PER-CATEGORY (`[categoryOrder, order]`),
 * so a flat global index would clash across categories. Groups by each teacher's
 * current category, assigns `order` = position WITHIN that category. categoryOrder
 * untouched. Runs in a transaction.
 */
export async function reorderTeachers(orderedIds: string[]): Promise<void> {
  const rows = await prisma.teacher.findMany({
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
      return prisma.teacher.update({ where: { id }, data: { order: next } });
    });
  await prisma.$transaction(updates);
}
