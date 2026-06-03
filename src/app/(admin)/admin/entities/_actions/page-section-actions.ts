'use server';

import { revalidateTag } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { withRole, type ActionResult } from '@/lib/auth/server-action-guard';
import { writeAudit } from '@/lib/security/audit';
import { pageSectionPhotoPatchSchema } from '@/lib/validation/schemas/page-sections/photo-patch';
import { setSectionPhoto, getSectionPhoto } from '@/lib/data/repositories/section-photo-repo';
import { syncPhotoUsage } from '@/lib/media/sync-photo-usage';

/**
 * Persist a single section photo. Auth → Zod (validates the slot triple +
 * photo) → read prev (for MediaUsage diff) → upsert → sync usage → audit →
 * revalidate. Text lives in config now; only the 6 photo slots are DB-backed
 * (SectionPhoto). Revalidate both the section-photos cache (assembler overlay)
 * and the page tag.
 */
export async function updatePageSectionPhotoAction(raw: unknown): Promise<ActionResult<void>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    const patch = pageSectionPhotoPatchSchema.parse(raw);
    const prev = await getSectionPhoto(patch.pageKey, patch.sectionKey, patch.field);
    await setSectionPhoto(patch.pageKey, patch.sectionKey, patch.field, patch.photo);
    await syncPhotoUsage(prev, patch.photo, {
      usedInTable: 'SectionPhoto',
      usedInId: `${patch.pageKey}:${patch.sectionKey}:${patch.field}`,
      usedInField: 'photo',
    });
    await writeAudit({
      userId: user.id,
      action: 'update_page_photo',
      target: `${patch.pageKey}/${patch.sectionKey}/${patch.field}`,
    }).catch(() => {});
    revalidateTag('section-photos');
    revalidateTag(`page:${patch.pageKey}`);
  });
}
