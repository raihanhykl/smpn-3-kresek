import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/db/client';
import type { GalleryItem } from '@config/types';

function rowToGalleryItem(r: {
  id: string; caption: string; emoji: string; gradientFrom: string; gradientTo: string;
  category: string | null; span: string | null;
}): GalleryItem {
  const item: GalleryItem = {
    id: r.id, caption: r.caption, emoji: r.emoji,
    gradientFrom: r.gradientFrom, gradientTo: r.gradientTo,
  };
  if (r.category) item.category = r.category;
  if (r.span) item.span = r.span as NonNullable<GalleryItem['span']>;
  return item;
}

async function loadAllGalleryItems(): Promise<GalleryItem[]> {
  const rows = await prisma.galleryItem.findMany({ orderBy: [{ order: 'asc' }] });
  return rows.map(rowToGalleryItem);
}

/**
 * All gallery items. Used by /fasilitas galeri page with filter UI.
 */
export const getAllGalleryItems = unstable_cache(loadAllGalleryItems, ['gallery', 'all'], {
  tags: ['gallery'],
});

/**
 * Subset by ID list, preserving caller order. Used by /home gallery whose
 * featured-8 IDs are stored in PageSection.galleryMeta.featuredIds.
 */
export function getGalleryItemsByIds(ids: readonly string[]): Promise<GalleryItem[]> {
  const cached = unstable_cache(
    async () => {
      const rows = await prisma.galleryItem.findMany({ where: { id: { in: [...ids] } } });
      const byId = new Map(rows.map((r) => [r.id, rowToGalleryItem(r)]));
      return ids.map((id) => byId.get(id)).filter((x): x is GalleryItem => x !== undefined);
    },
    ['gallery', 'by-ids', ids.join(',')],
    { tags: ['gallery'] },
  );
  return cached();
}
