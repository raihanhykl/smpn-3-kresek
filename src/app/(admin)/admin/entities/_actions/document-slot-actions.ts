'use server';

import { z } from 'zod';
import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/db/client';
import { getSession } from '@/lib/auth/session';
import { withRole, type ActionResult } from '@/lib/auth/server-action-guard';
import { writeAudit } from '@/lib/security/audit';
import { linkMediaUsage, unlinkMediaUsage } from '@/lib/media/link-usage';
import { DOCUMENT_SLOT_IDS } from '@config/document-slots';

const inputSchema = z.object({
  slotId: z.enum(DOCUMENT_SLOT_IDS),
  mediaId: z.string().nullable(),
});

/**
 * Replace (or detach) the PDF linked to a DocumentSlot.
 *
 * Order of operations:
 *  1. Read the slot's current mediaId (for the unlink step).
 *  2. Upsert the slot row (id is the natural key — `upsert` so we still work
 *     against a DB seeded before the slots were known).
 *  3. Unlink old MediaUsage (if any) and link the new one (if any).
 *  4. Audit + revalidate the relevant cache tags.
 */
export async function updateDocumentSlotAction(
  raw: unknown,
): Promise<ActionResult<{ slotId: string; mediaId: string | null }>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    const { slotId, mediaId } = inputSchema.parse(raw);
    const previous = await prisma.documentSlot.findUnique({
      where: { id: slotId }, select: { mediaId: true },
    });
    await prisma.documentSlot.upsert({
      where: { id: slotId },
      create: { id: slotId, mediaId, updatedBy: user.id },
      update: { mediaId, updatedBy: user.id },
    });
    if (previous?.mediaId && previous.mediaId !== mediaId) {
      await unlinkMediaUsage({
        mediaId: previous.mediaId,
        usedInTable: 'DocumentSlot',
        usedInId: slotId,
        usedInField: 'mediaId',
      });
    }
    if (mediaId) {
      await linkMediaUsage({
        mediaId,
        usedInTable: 'DocumentSlot',
        usedInId: slotId,
        usedInField: 'mediaId',
      });
    }
    writeAudit({
      userId: user.id,
      action: 'document_slot_update',
      target: `DocumentSlot:${slotId}`,
      metadata: { previous: previous?.mediaId ?? null, next: mediaId },
    }).catch(() => {});
    revalidateTag('documents');
    revalidateTag('page:akademik');
    revalidateTag('page:fasilitas');
    return { slotId, mediaId };
  });
}
