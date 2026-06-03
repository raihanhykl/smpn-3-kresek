import { auth } from '@/lib/auth/config';
import { AdminShell } from '@/components/admin/AdminShell';
import { getDocumentSlotWithMedia } from '@/lib/data/repositories/document-slot-repo';
import { DOCUMENT_SLOT_IDS } from '@config/document-slots';
import { DocumentSlotManager, type SlotSnapshot } from './DocumentSlotManager';

export const dynamic = 'force-dynamic';

export default async function DocumentSlotsPage() {
  const session = await auth();
  const slotsRaw = await Promise.all(
    DOCUMENT_SLOT_IDS.map((id) => getDocumentSlotWithMedia(id)),
  );
  const slots: SlotSnapshot[] = slotsRaw.map((raw, idx) => {
    const id = DOCUMENT_SLOT_IDS[idx]!;
    if (!raw || !raw.media) return { id, media: null };
    return {
      id,
      media: {
        id: raw.media.id,
        publicId: raw.media.publicId,
        filename: raw.media.filename,
        sizeBytes: raw.media.sizeBytes,
      },
    };
  });

  return (
    <AdminShell userName={session?.user.name ?? 'Admin'} role={session?.user.role ?? 'EDITOR'}>
      <DocumentSlotManager slots={slots} />
    </AdminShell>
  );
}
