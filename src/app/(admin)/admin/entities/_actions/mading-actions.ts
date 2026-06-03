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
import { syncPhotoUsage } from '@/lib/media/sync-photo-usage';
import type { Mading, MadingImage, Photo } from '@config/types';

function revalidateMading() {
  revalidateTag('mading');
}

const imageRef = (id: string, i: number) => ({
  usedInTable: 'Mading',
  usedInId: id,
  usedInField: `image:${i}`,
});

function toUrlPhoto(img: MadingImage | undefined): Photo | null {
  return img ? { kind: 'url', src: img.src, alt: img.alt } : null;
}

async function syncImageUsages(
  id: string,
  prev: MadingImage[],
  next: MadingImage[],
): Promise<void> {
  const len = Math.max(prev.length, next.length);
  for (let i = 0; i < len; i++) {
    await syncPhotoUsage(toUrlPhoto(prev[i]), toUrlPhoto(next[i]), imageRef(id, i));
  }
}

export async function createMadingAction(raw: unknown): Promise<ActionResult<Mading>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    const input = madingInputSchema.parse(raw) as MadingInput;
    const created = await createMading(input);
    await syncImageUsages(created.id, [], created.images);
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
    await syncImageUsages(id, prev?.images ?? [], updated.images);
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
    await syncImageUsages(id, prev?.images ?? [], []);
    await writeAudit({ userId: user.id, action: 'delete_mading', target: `mading:${id}` }).catch(() => {});
    revalidateMading();
  });
}
