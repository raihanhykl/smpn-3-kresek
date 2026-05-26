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
