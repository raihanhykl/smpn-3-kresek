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
 * All gallery items, ordered. /fasilitas shows the full list (with filter UI);
 * /home shows the top-N.
 */
export const getAllGalleryItems = unstable_cache(loadAllGalleryItems, ['gallery', 'all'], {
  tags: ['gallery'],
});

export type GalleryItemInput = Omit<GalleryItem, 'id'>;

function inputToColumns(input: GalleryItemInput) {
  return {
    caption: input.caption,
    emoji: input.emoji,
    gradientFrom: input.gradientFrom,
    gradientTo: input.gradientTo,
    category: input.category ?? null,
    span: input.span ?? null,
  };
}

export async function createGalleryItem(input: GalleryItemInput): Promise<GalleryItem> {
  const max = await prisma.galleryItem.aggregate({ _max: { order: true } });
  const order = (max._max.order ?? -1) + 1;
  const row = await prisma.galleryItem.create({ data: { ...inputToColumns(input), order } });
  return rowToGalleryItem(row);
}

export async function updateGalleryItem(id: string, input: GalleryItemInput): Promise<GalleryItem> {
  const row = await prisma.galleryItem.update({ where: { id }, data: inputToColumns(input) });
  return rowToGalleryItem(row);
}

export async function deleteGalleryItem(id: string): Promise<void> {
  await prisma.galleryItem.delete({ where: { id } });
}

export async function reorderGalleryItems(orderedIds: string[]): Promise<void> {
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.galleryItem.update({ where: { id }, data: { order: index } }),
    ),
  );
}
