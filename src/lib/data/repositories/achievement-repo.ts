import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/db/client';
import type { Achievement } from '@config/types';
import { photoFromRow, photoToColumns } from './_photo-columns';

type AchievementRow = {
  id: string; year: number; title: string; recipient: string;
  organizer: string; level: string;
  photoKind: string; photoSrc: string | null; photoAlt: string | null;
  photoFrom: string | null; photoTo: string | null; photoEmoji: string | null;
  photoCropX: number | null; photoCropY: number | null;
  photoCropW: number | null; photoCropH: number | null;
};

function rowToAchievement(r: AchievementRow): Achievement {
  return {
    id: r.id, year: r.year, title: r.title, recipient: r.recipient,
    organizer: r.organizer, level: r.level as Achievement['level'],
    photo: photoFromRow('Achievement', r.id, r),
  };
}

async function loadAllAchievements(): Promise<Achievement[]> {
  const rows = await prisma.achievement.findMany({ orderBy: [{ order: 'asc' }, { year: 'desc' }] });
  return rows.map(rowToAchievement);
}

/**
 * All achievements, ordered. /profil shows the full list; /home shows the top-N.
 */
export const getAllAchievements = unstable_cache(loadAllAchievements, ['achievements', 'all', 'v2-photo'], {
  tags: ['achievements'],
});

export async function getAchievementById(id: string): Promise<Achievement | null> {
  const row = await prisma.achievement.findUnique({ where: { id } });
  return row ? rowToAchievement(row) : null;
}

export type AchievementInput = Omit<Achievement, 'id'>;

function inputToColumns(input: AchievementInput) {
  return {
    year: input.year,
    title: input.title,
    recipient: input.recipient,
    organizer: input.organizer,
    level: input.level,
    ...photoToColumns(input.photo),
  };
}

export async function createAchievement(input: AchievementInput): Promise<Achievement> {
  const max = await prisma.achievement.aggregate({ _max: { order: true } });
  const order = (max._max.order ?? -1) + 1;
  const row = await prisma.achievement.create({
    data: { ...inputToColumns(input), order },
  });
  return rowToAchievement(row);
}

export async function updateAchievement(id: string, input: AchievementInput): Promise<Achievement> {
  const row = await prisma.achievement.update({
    where: { id },
    data: inputToColumns(input),
  });
  return rowToAchievement(row);
}

export async function deleteAchievement(id: string): Promise<void> {
  await prisma.achievement.delete({ where: { id } });
}

export async function reorderAchievements(orderedIds: string[]): Promise<void> {
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.achievement.update({ where: { id }, data: { order: index } }),
    ),
  );
}
