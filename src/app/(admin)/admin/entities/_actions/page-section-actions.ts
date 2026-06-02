'use server';

import { revalidateTag } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { withRole, type ActionResult } from '@/lib/auth/server-action-guard';
import { writeAudit } from '@/lib/security/audit';
import { pageSectionPhotoPatchSchema } from '@/lib/validation/schemas/page-sections/photo-patch';
import { setPageSectionPhoto, getPageSectionPhoto } from '@/lib/data/repositories/page-section-repo';
import { syncPhotoUsage } from '@/lib/media/sync-photo-usage';

/**
 * Phase 5: persist a single section photo. Auth → Zod (validates the slot
 * triple + photo) → read prev (for MediaUsage diff) → write → sync usage →
 * audit → revalidate the page tag so the public page re-reads fresh.
 */
export async function updatePageSectionPhotoAction(raw: unknown): Promise<ActionResult<void>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    const patch = pageSectionPhotoPatchSchema.parse(raw);
    const prev = await getPageSectionPhoto(patch.pageKey, patch.sectionKey, patch.field);
    await setPageSectionPhoto(patch.pageKey, patch.sectionKey, patch.field, patch.photo);
    await syncPhotoUsage(prev, patch.photo, {
      usedInTable: 'PageSection',
      usedInId: `${patch.pageKey}:${patch.sectionKey}:${patch.field}`,
      usedInField: 'photo',
    });
    await writeAudit({
      userId: user.id,
      action: 'update_page_photo',
      target: `${patch.pageKey}/${patch.sectionKey}/${patch.field}`,
    }).catch(() => {});
    revalidateTag(`page:${patch.pageKey}`);
  });
}
