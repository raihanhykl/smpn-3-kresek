'use server';

import { revalidateTag } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { withRole, type ActionResult } from '@/lib/auth/server-action-guard';
import { writeAudit } from '@/lib/security/audit';
import { achievementSchema } from '@/lib/validation/schemas/entities/achievement';
import {
  createAchievement, updateAchievement, deleteAchievement, reorderAchievements,
  getAchievementById,
  type AchievementInput,
} from '@/lib/data/repositories/achievement-repo';
import { syncPhotoUsage } from '@/lib/media/sync-photo-usage';
import type { Achievement } from '@config/types';

const achievementInputSchema = achievementSchema.omit({ id: true });

function revalidateAchievements() {
  revalidateTag('achievements');
  revalidateTag('page:home');
  revalidateTag('page:profil');
}

const usageRef = (id: string) => ({
  usedInTable: 'Achievement',
  usedInId: id,
  usedInField: 'photoSrc',
});

export async function createAchievementAction(raw: unknown): Promise<ActionResult<Achievement>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    const input = achievementInputSchema.parse(raw) as AchievementInput;
    const created = await createAchievement(input);
    await syncPhotoUsage(null, created.photo, usageRef(created.id));
    await writeAudit({ userId: user.id, action: 'create_achievement', target: `achievement:${created.id}` }).catch(() => {});
    revalidateAchievements();
    return created;
  });
}

export async function updateAchievementAction(id: string, raw: unknown): Promise<ActionResult<Achievement>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    const input = achievementInputSchema.parse(raw) as AchievementInput;
    const prev = await getAchievementById(id);
    const updated = await updateAchievement(id, input);
    await syncPhotoUsage(prev?.photo ?? null, updated.photo, usageRef(id));
    await writeAudit({ userId: user.id, action: 'update_achievement', target: `achievement:${id}` }).catch(() => {});
    revalidateAchievements();
    return updated;
  });
}

export async function deleteAchievementAction(id: string): Promise<ActionResult<void>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    const prev = await getAchievementById(id);
    await deleteAchievement(id);
    await syncPhotoUsage(prev?.photo ?? null, null, usageRef(id));
    await writeAudit({ userId: user.id, action: 'delete_achievement', target: `achievement:${id}` }).catch(() => {});
    revalidateAchievements();
  });
}

export async function reorderAchievementsAction(orderedIds: string[]): Promise<ActionResult<void>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    await reorderAchievements(orderedIds);
    await writeAudit({ userId: user.id, action: 'reorder_achievement', target: 'achievement:*' }).catch(() => {});
    revalidateAchievements();
  });
}
