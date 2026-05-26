import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/db/client';

export type DocumentSlotData = { id: string; mediaId: string | null };

async function loadDocumentSlot(id: string): Promise<DocumentSlotData | null> {
  const row = await prisma.documentSlot.findUnique({ where: { id } });
  if (!row) return null;
  return { id: row.id, mediaId: row.mediaId };
}

export function getDocumentSlot(id: string): Promise<DocumentSlotData | null> {
  const cached = unstable_cache(
    () => loadDocumentSlot(id),
    ['document-slot', id],
    { tags: ['documents'] },
  );
  return cached();
}
