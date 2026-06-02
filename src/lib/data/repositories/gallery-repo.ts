import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/db/client';
import type { GalleryItem } from '@config/types';
import { photoFromRow, photoToColumns } from './_photo-columns';

type GalleryRow = {
  id: string;
  caption: string;
  photoKind: string;
  photoSrc: string | null;
  photoAlt: string | null;
  photoFrom: string | null;
  photoTo: string | null;
  photoEmoji: string | null;
  photoCropX: number | null;
  photoCropY: number | null;
  photoCropW: number | null;
  photoCropH: number | null;
  category: string | null;
  span: string | null;
};

function rowToGalleryItem(r: GalleryRow): GalleryItem {
  const item: GalleryItem = {
    id: r.id,
    caption: r.caption,
    photo: photoFromRow('GalleryItem', r.id, r),
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
export const getAllGalleryItems = unstable_cache(loadAllGalleryItems, ['gallery', 'all', 'v2-photo'], {
  tags: ['gallery'],
});

export async function getGalleryItemById(id: string): Promise<GalleryItem | null> {
  const row = await prisma.galleryItem.findUnique({ where: { id } });
  return row ? rowToGalleryItem(row) : null;
}

export type GalleryItemInput = Omit<GalleryItem, 'id'>;

function inputToColumns(input: GalleryItemInput) {
  return {
    caption: input.caption,
    ...photoToColumns(input.photo),
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
