'use server';

import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/db/client';
import { withRole, type ActionResult } from '@/lib/auth/server-action-guard';
import { getSession } from '@/lib/auth/session';
import { writeAudit } from '@/lib/security/audit';
import { destroyCloudinaryAsset } from '@/lib/media/cloudinary-destroy';
import {
  deleteMediaAsset, getMediaAssetById, getMediaAssetUsage,
} from '@/lib/data/repositories/media-repo';

/**
 * Tags revalidated whenever a MediaAsset row changes — any page that may
 * render media via cldUrl(publicId) needs to refetch.
 */
function revalidateMediaConsumers() {
  revalidateTag('media');
  revalidateTag('teachers');
  revalidateTag('documents');
  revalidateTag('page:profil');
  revalidateTag('page:akademik');
  revalidateTag('page:fasilitas');
  revalidateTag('section-photos');
}

export type DeleteMediaResult =
  | { deleted: true }
  | {
      deleted: false;
      usage: Array<{ usedInTable: string; usedInId: string; usedInField: string }>;
    };

/**
 * Safe delete: refuses to remove a MediaAsset that is still referenced. The
 * UI surfaces the usage list so an admin can detach references first.
 */
export async function deleteMediaAction(id: string): Promise<ActionResult<DeleteMediaResult>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    const exists = await getMediaAssetById(id);
    if (!exists) throw Object.assign(new Error('not found'), { code: 'P2025' });
    const usage = await getMediaAssetUsage(id);
    if (usage.length > 0) {
      return { deleted: false, usage } satisfies DeleteMediaResult;
    }
    await deleteMediaAsset(id);
    writeAudit({
      userId: user.id, action: 'media_delete', target: `MediaAsset:${id}`,
    }).catch(() => {});
    revalidateMediaConsumers();
    return { deleted: true } satisfies DeleteMediaResult;
  });
}

/**
 * ADMIN-only force delete: unlinks all MediaUsage rows in a transaction, then
 * deletes the MediaAsset. Used by the /admin/media "Hapus catatan" button when
 * the underlying Cloudinary file is missing (broken row) — the safe delete
 * would refuse, so this provides an explicit escape hatch.
 *
 * Audit action `media_force_delete` distinguishes this from a normal delete in
 * the audit trail.
 */
export async function forceDeleteMediaAction(id: string): Promise<ActionResult<{ deleted: true }>> {
  const session = await getSession();
  return withRole(session, ['ADMIN'], async (user) => {
    const exists = await getMediaAssetById(id);
    if (!exists) throw Object.assign(new Error('not found'), { code: 'P2025' });
    // Best-effort: force delete exists for broken rows whose Cloudinary file may
    // be missing. Try to remove the file too, but never block the row cleanup on
    // it. The network call must stay OUTSIDE the transaction below.
    try {
      await destroyCloudinaryAsset(exists.publicId, exists.kind === 'pdf' ? 'raw' : 'image');
    } catch { /* ignore — the whole point is to clear a row whose file is gone */ }
    await prisma.$transaction(async (tx) => {
      await tx.mediaUsage.deleteMany({ where: { mediaId: id } });
      await tx.mediaAsset.delete({ where: { id } });
    });
    writeAudit({
      userId: user.id, action: 'media_force_delete', target: `MediaAsset:${id}`,
    }).catch(() => {});
    revalidateMediaConsumers();
    return { deleted: true };
  });
}
