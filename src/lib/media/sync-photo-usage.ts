import type { Photo } from '@config/types';
import { prisma } from '@/lib/db/client';
import { linkMediaUsage, unlinkMediaUsage } from './link-usage';

/**
 * Phase 3b: shared "photo changed, sync the MediaUsage link" helper.
 *
 * Every entity that owns a `Photo` discriminated union (Teacher, GalleryItem,
 * Facility-featured, Extracurricular, Achievement) calls this after a write.
 * It examines the prev → next transition and emits the right link/unlink:
 *
 *   gradient → gradient   → no-op (no usage tracking)
 *   gradient → url        → linkMediaUsage(next.src)
 *   url      → gradient   → unlinkMediaUsage(prev.src)
 *   url      → url(same)  → no-op (same publicId)
 *   url      → url(diff)  → unlink(prev.src) + link(next.src)
 *   null     → url        → linkMediaUsage(next.src)
 *   url      → null       → unlinkMediaUsage(prev.src)  (used by delete-entity)
 *
 * The MediaAsset.id is resolved via MediaAsset.publicId (which equals
 * photo.src per the Phase 3 storage rule). Both link/unlink helpers from
 * Chunk 3 are P2002-idempotent, so calling them twice is safe.
 */

export type MediaUsageRef = {
  usedInTable: string;
  usedInId: string;
  usedInField: string;
};

async function publicIdToMediaId(publicId: string): Promise<string | null> {
  const row = await prisma.mediaAsset.findUnique({
    where: { publicId },
    select: { id: true },
  });
  return row?.id ?? null;
}

export async function syncPhotoUsage(
  prev: Photo | null,
  next: Photo | null,
  ref: MediaUsageRef,
): Promise<void> {
  const prevSrc = prev?.kind === 'url' ? prev.src : null;
  const nextSrc = next?.kind === 'url' ? next.src : null;

  // No url-side on either branch → nothing to track.
  if (prevSrc === null && nextSrc === null) return;
  // Same publicId on both sides → nothing changed.
  if (prevSrc !== null && prevSrc === nextSrc) return;

  if (prevSrc !== null) {
    const prevId = await publicIdToMediaId(prevSrc);
    if (prevId !== null) {
      await unlinkMediaUsage({ mediaId: prevId, ...ref });
    }
    // If the MediaAsset row is gone (race / manual cleanup), the FK no longer
    // exists either — nothing to unlink. Silent.
  }

  if (nextSrc !== null) {
    const nextId = await publicIdToMediaId(nextSrc);
    if (nextId !== null) {
      await linkMediaUsage({ mediaId: nextId, ...ref });
    }
    // If the picker handed us a publicId that doesn't resolve, something is
    // wrong upstream — but breaking the write here would block the user.
    // Audit-log layer will surface the orphan; safe to skip the link.
  }
}
