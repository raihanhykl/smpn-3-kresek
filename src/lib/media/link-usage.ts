import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';

/**
 * Phase 3 MediaUsage tracking helpers.
 *
 * /api/media/confirm NEVER writes MediaUsage — uploads always land as orphans.
 * Form server actions call `linkMediaUsage(...)` after a successful save so
 * "Pakai berkas yang sudah diupload" and "Upload baru" flows behave the same.
 *
 * The composite unique on (mediaId, usedInTable, usedInId, usedInField) makes
 * link/unlink fully idempotent — calling link twice produces exactly one row;
 * calling unlink when nothing is linked is a no-op.
 */

export type MediaUsageLink = {
  mediaId: string;
  usedInTable: string;
  usedInId: string;
  usedInField: string;
};

export async function linkMediaUsage(link: MediaUsageLink): Promise<void> {
  try {
    await prisma.mediaUsage.create({ data: link });
  } catch (err) {
    // Already linked → idempotent. Swallow.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return;
    throw err;
  }
}

export async function unlinkMediaUsage(link: MediaUsageLink): Promise<void> {
  // deleteMany returns count=0 when nothing matches — no error needed.
  await prisma.mediaUsage.deleteMany({ where: link });
}
