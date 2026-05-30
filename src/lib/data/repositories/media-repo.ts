import { unstable_cache } from 'next/cache';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import type { PublicMediaAsset } from '@/lib/validation/schemas/media';
import type { MediaKind } from '@/lib/media/limits';

/**
 * Phase 3 MediaAsset repository.
 *
 * NOTE on MediaAsset.url: the column exists as a denormalized cache populated
 * at /api/media/confirm time. Render code MUST resolve URLs via
 * `cldUrl(publicId, variant)` — the cache exists only for the /admin/media
 * library list view and for audit-log readability. A future Phase 5 migrate
 * script swaps the Cloudinary cloud name; thanks to publicId-as-truth, the
 * DB needs zero rewrites for a "soft" handover.
 */

type MediaAssetRow = {
  id: string;
  kind: string;
  url: string;
  publicId: string;
  hash: string;
  alt: string | null;
  filename: string;
  sizeBytes: number;
  mimeType: string;
  width: number | null;
  height: number | null;
};

function toPublic(row: MediaAssetRow): PublicMediaAsset {
  return {
    id: row.id,
    kind: row.kind as MediaKind,
    url: row.url,
    publicId: row.publicId,
    alt: row.alt,
    filename: row.filename,
    sizeBytes: row.sizeBytes,
    mimeType: row.mimeType,
    width: row.width,
    height: row.height,
  };
}

const PUBLIC_SELECT = {
  id: true, kind: true, url: true, publicId: true, hash: true, alt: true,
  filename: true, sizeBytes: true, mimeType: true, width: true, height: true,
} as const;

// ─── Reads ───────────────────────────────────────────────────────────────

async function loadMediaAssetByHash(hash: string): Promise<PublicMediaAsset | null> {
  const row = await prisma.mediaAsset.findUnique({ where: { hash }, select: PUBLIC_SELECT });
  return row ? toPublic(row) : null;
}

export function getMediaAssetByHash(hash: string): Promise<PublicMediaAsset | null> {
  const cached = unstable_cache(
    () => loadMediaAssetByHash(hash),
    ['media', 'by-hash', hash],
    { tags: ['media'] },
  );
  return cached();
}

async function loadMediaAssetById(id: string): Promise<PublicMediaAsset | null> {
  const row = await prisma.mediaAsset.findUnique({ where: { id }, select: PUBLIC_SELECT });
  return row ? toPublic(row) : null;
}

export function getMediaAssetById(id: string): Promise<PublicMediaAsset | null> {
  const cached = unstable_cache(
    () => loadMediaAssetById(id),
    ['media', 'by-id', id],
    { tags: ['media'] },
  );
  return cached();
}

export type ListMediaArgs = {
  kind?: MediaKind;
  cursor?: string | null;
  limit?: number;
};

const LIST_LIMIT_MAX = 50;
const LIST_LIMIT_DEFAULT = 24;

/**
 * Keyset-paginated list ordered by `createdAt desc, id desc`. `cursor` is the
 * id of the last row returned (clients echo it back to fetch the next page).
 *
 * NOT wrapped in unstable_cache: the cursor varies per request and the result
 * changes on any upload — caching here would mostly miss. Add per-tag
 * invalidation if usage shows hot paths.
 */
export async function listMediaAssets(
  args: ListMediaArgs = {},
): Promise<{ items: PublicMediaAsset[]; nextCursor: string | null }> {
  const limit = Math.max(1, Math.min(args.limit ?? LIST_LIMIT_DEFAULT, LIST_LIMIT_MAX));
  const cursor = args.cursor ?? null;
  // Fetch one extra row to detect the next-page boundary.
  const rows = await prisma.mediaAsset.findMany({
    where: { ...(args.kind ? { kind: args.kind } : {}) },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    select: PUBLIC_SELECT,
  });
  const hasMore = rows.length > limit;
  const items = (hasMore ? rows.slice(0, limit) : rows).map(toPublic);
  const nextCursor = hasMore ? (items.at(-1)?.id ?? null) : null;
  return { items, nextCursor };
}

export async function getMediaAssetUsage(
  id: string,
): Promise<Array<{ usedInTable: string; usedInId: string; usedInField: string }>> {
  return prisma.mediaUsage.findMany({
    where: { mediaId: id },
    select: { usedInTable: true, usedInId: true, usedInField: true },
    orderBy: [{ usedInTable: 'asc' }, { usedInId: 'asc' }, { usedInField: 'asc' }],
  });
}

// ─── Writes ──────────────────────────────────────────────────────────────

export type CreateMediaAssetInput = {
  kind: MediaKind;
  url: string;
  publicId: string;
  hash: string;
  alt: string | null;
  filename: string;
  sizeBytes: number;
  mimeType: string;
  width: number | null;
  height: number | null;
  uploadedBy: string;
};

/**
 * Idempotent create: a P2002 unique violation on `hash` or `publicId` means
 * another writer raced ahead, so we look the existing row up and return it.
 * Both concurrent /confirm calls thus receive the SAME `media.id`.
 */
export async function createMediaAsset(input: CreateMediaAssetInput): Promise<PublicMediaAsset> {
  try {
    const row = await prisma.mediaAsset.create({
      data: input,
      select: PUBLIC_SELECT,
    });
    return toPublic(row);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const existing = await loadMediaAssetByHash(input.hash);
      if (existing) return existing;
      // publicId raced but hash didn't (shouldn't happen with deterministic
      // hash-derived publicIds, but cover the case for safety).
      const byPublicId = await prisma.mediaAsset.findUnique({
        where: { publicId: input.publicId }, select: PUBLIC_SELECT,
      });
      if (byPublicId) return toPublic(byPublicId);
    }
    throw err;
  }
}

/**
 * Hard delete. The FK on `MediaUsage.media` is onDelete: Cascade, so usage rows
 * are removed automatically. DocumentSlot.media uses onDelete: SetNull instead,
 * so slots referencing this asset just lose their reference (rather than
 * disappearing themselves). Both behaviours come from prisma/schema.prisma.
 */
export async function deleteMediaAsset(id: string): Promise<void> {
  await prisma.mediaAsset.delete({ where: { id } });
}
