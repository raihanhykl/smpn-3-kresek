'use server';

import { revalidateTag } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { withRole, type ActionResult } from '@/lib/auth/server-action-guard';
import { writeAudit } from '@/lib/security/audit';
import { achievementSchema } from '@/lib/validation/schemas/entities/achievement';
import {
  createAchievement, updateAchievement, deleteAchievement, reorderAchievements,
  type AchievementInput,
} from '@/lib/data/repositories/achievement-repo';
import type { Achievement } from '@config/types';

const achievementInputSchema = achievementSchema.omit({ id: true });

function revalidateAchievements() {
  revalidateTag('achievements');
  revalidateTag('page:home');
  revalidateTag('page:profil');
}

export async function createAchievementAction(raw: unknown): Promise<ActionResult<Achievement>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    const input = achievementInputSchema.parse(raw) as AchievementInput;
    const created = await createAchievement(input);
    await writeAudit({ userId: user.id, action: 'create_achievement', target: `achievement:${created.id}` }).catch(() => {});
    revalidateAchievements();
    return created;
  });
}

export async function updateAchievementAction(id: string, raw: unknown): Promise<ActionResult<Achievement>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    const input = achievementInputSchema.parse(raw) as AchievementInput;
    const updated = await updateAchievement(id, input);
    await writeAudit({ userId: user.id, action: 'update_achievement', target: `achievement:${id}` }).catch(() => {});
    revalidateAchievements();
    return updated;
  });
}

export async function deleteAchievementAction(id: string): Promise<ActionResult<void>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    await deleteAchievement(id);
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
