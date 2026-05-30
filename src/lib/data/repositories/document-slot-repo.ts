import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/db/client';
import type { PublicMediaAsset } from '@/lib/validation/schemas/media';
import type { MediaKind } from '@/lib/media/limits';
import { toCachedUrl } from '@/lib/media/branded-types';

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

// ─── Phase 3: joined-with-media projection ──────────────────────────────
//
// Additive helper used by the akademik + fasilitas assemblers and the admin
// page. Returns the FULL MediaAsset projection so the public side can call
// cldUrl(media.publicId, 'pdf') for the download link. When media is missing,
// `media: null` so the public component hides the download button entirely
// (the long-standing spec gap the plan closes in Chunk 8).
//
// Cache tag is the SAME 'documents' tag used by the existing helper above —
// any revalidateTag('documents') call busts both.

export type DocumentSlotWithMedia = {
  id: string;
  media: PublicMediaAsset | null;
} | null;

async function loadDocumentSlotWithMedia(id: string): Promise<DocumentSlotWithMedia> {
  const row = await prisma.documentSlot.findUnique({
    where: { id },
    include: {
      media: {
        select: {
          id: true, kind: true, url: true, publicId: true, alt: true,
          filename: true, sizeBytes: true, mimeType: true, width: true, height: true,
        },
      },
    },
  });
  if (!row) return null;
  if (!row.media) return { id: row.id, media: null };
  const m = row.media;
  return {
    id: row.id,
    media: {
      id: m.id,
      kind: m.kind as MediaKind,
      url: toCachedUrl(m.url),
      publicId: m.publicId,
      alt: m.alt,
      filename: m.filename,
      sizeBytes: m.sizeBytes,
      mimeType: m.mimeType,
      width: m.width,
      height: m.height,
    },
  };
}

export function getDocumentSlotWithMedia(id: string): Promise<DocumentSlotWithMedia> {
  const cached = unstable_cache(
    () => loadDocumentSlotWithMedia(id),
    ['document-slot-with-media', id],
    { tags: ['documents'] },
  );
  return cached();
}
