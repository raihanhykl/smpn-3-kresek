'use server';

import { revalidateTag } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { withRole, type ActionResult } from '@/lib/auth/server-action-guard';
import { writeAudit } from '@/lib/security/audit';
import { madingInputSchema } from '@/lib/validation/schemas/entities/mading';
import {
  createMading, updateMading, deleteMading, getMadingById,
  type MadingInput,
} from '@/lib/data/repositories/mading-repo';
import { reconcileMadingImageUsages } from '@/lib/media/mading-usage';
import type { Mading } from '@config/types';

function revalidateMading() {
  revalidateTag('mading');
}

export async function createMadingAction(raw: unknown): Promise<ActionResult<Mading>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    const input = madingInputSchema.parse(raw) as MadingInput;
    const created = await createMading(input);
    await reconcileMadingImageUsages(created.id, [], created.images);
    await writeAudit({ userId: user.id, action: 'create_mading', target: `mading:${created.id}` }).catch(() => {});
    revalidateMading();
    return created;
  });
}

export async function updateMadingAction(id: string, raw: unknown): Promise<ActionResult<Mading>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    const input = madingInputSchema.parse(raw) as MadingInput;
    const prev = await getMadingById(id);
    const updated = await updateMading(id, input);
    await reconcileMadingImageUsages(id, prev?.images ?? [], updated.images);
    await writeAudit({ userId: user.id, action: 'update_mading', target: `mading:${id}` }).catch(() => {});
    revalidateMading();
    return updated;
  });
}

export async function deleteMadingAction(id: string): Promise<ActionResult<void>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    const prev = await getMadingById(id);
    await deleteMading(id);
    await reconcileMadingImageUsages(id, prev?.images ?? [], []);
    await writeAudit({ userId: user.id, action: 'delete_mading', target: `mading:${id}` }).catch(() => {});
    revalidateMading();
  });
}
