import { auth } from '@/lib/auth/config';
import { AdminShell } from '@/components/admin/AdminShell';
import { getPageSectionPhoto } from '@/lib/data/repositories/page-section-repo';
import { PAGE_PHOTO_SLOTS } from '@/lib/validation/schemas/page-sections/photo-patch';
import type { Photo } from '@config/types';
import { PageSectionPhotoManager, type SlotSnapshot } from './PageSectionPhotoManager';

export const dynamic = 'force-dynamic';

export default async function PagesPhotoEditorPage() {
  const session = await auth();
  const slots: SlotSnapshot[] = await Promise.all(
    PAGE_PHOTO_SLOTS.map(async (s): Promise<SlotSnapshot> => {
      const current = await getPageSectionPhoto(s.pageKey, s.sectionKey, s.field);
      return {
        pageKey: s.pageKey,
        sectionKey: s.sectionKey,
        field: s.field,
        label: s.label,
        aspect: s.aspect,
        emoji: s.emoji,
        photo: current as Photo | null,
      };
    }),
  );
  return (
    <AdminShell userName={session?.user.name ?? 'Admin'} role={session?.user.role ?? 'EDITOR'}>
      <PageSectionPhotoManager slots={slots} />
    </AdminShell>
  );
}
