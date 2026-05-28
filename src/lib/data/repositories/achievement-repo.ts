import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/db/client';
import type { Achievement } from '@config/types';

function rowToAchievement(r: {
  id: string; year: number; title: string; recipient: string;
  organizer: string; level: string; icon: string;
}): Achievement {
  return {
    id: r.id, year: r.year, title: r.title, recipient: r.recipient,
    organizer: r.organizer, level: r.level as Achievement['level'], icon: r.icon,
  };
}

async function loadAllAchievements(): Promise<Achievement[]> {
  const rows = await prisma.achievement.findMany({ orderBy: [{ order: 'asc' }, { year: 'desc' }] });
  return rows.map(rowToAchievement);
}

/**
 * All achievements, ordered. Used by /profil's full prestasi list.
 */
export const getAllAchievements = unstable_cache(loadAllAchievements, ['achievements', 'all'], {
  tags: ['achievements'],
});

/**
 * Subset by explicit ID list, preserving the input order. Used by /home's
 * featured-5 list whose IDs are stored in PageSection.achievementsMeta.featuredIds.
 * Returns only achievements that actually exist; missing IDs are silently dropped.
 */
export function getAchievementsByIds(ids: readonly string[]): Promise<Achievement[]> {
  const cached = unstable_cache(
    async () => {
      const rows = await prisma.achievement.findMany({ where: { id: { in: [...ids] } } });
      const byId = new Map(rows.map((r) => [r.id, rowToAchievement(r)]));
      // Preserve caller-provided order.
      return ids.map((id) => byId.get(id)).filter((x): x is Achievement => x !== undefined);
    },
    ['achievements', 'by-ids', ids.join(',')],
    { tags: ['achievements'] },
  );
  return cached();
}

export type AchievementInput = Omit<Achievement, 'id'>;

export async function createAchievement(input: AchievementInput): Promise<Achievement> {
  const max = await prisma.achievement.aggregate({ _max: { order: true } });
  const order = (max._max.order ?? -1) + 1;
  const row = await prisma.achievement.create({
    data: {
      year: input.year, title: input.title, recipient: input.recipient,
      organizer: input.organizer, level: input.level, icon: input.icon, order,
    },
  });
  return rowToAchievement(row);
}

export async function updateAchievement(id: string, input: AchievementInput): Promise<Achievement> {
  const row = await prisma.achievement.update({
    where: { id },
    data: {
      year: input.year, title: input.title, recipient: input.recipient,
      organizer: input.organizer, level: input.level, icon: input.icon,
    },
  });
  return rowToAchievement(row);
}

export async function deleteAchievement(id: string): Promise<void> {
  await prisma.achievement.delete({ where: { id } });
}

export async function reorderAchievements(orderedIds: string[]): Promise<void> {
  // Achievement has a single global `order` (not category-grouped), so global index
  // is correct here. (Contrast with reorderTeachers which is per-category.)
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.achievement.update({ where: { id }, data: { order: index } }),
    ),
  );
}
