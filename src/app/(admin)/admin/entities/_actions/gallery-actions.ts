'use server';

import { revalidateTag } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { withRole, type ActionResult } from '@/lib/auth/server-action-guard';
import { writeAudit } from '@/lib/security/audit';
import { galleryItemSchema } from '@/lib/validation/schemas/entities/gallery-item';
import {
  createGalleryItem, updateGalleryItem, deleteGalleryItem, reorderGalleryItems,
  getGalleryItemById,
  type GalleryItemInput,
} from '@/lib/data/repositories/gallery-repo';
import { syncPhotoUsage } from '@/lib/media/sync-photo-usage';
import type { GalleryItem } from '@config/types';

const galleryItemInputSchema = galleryItemSchema.omit({ id: true });

function revalidateGallery() {
  revalidateTag('gallery');
  revalidateTag('page:home');
  revalidateTag('page:fasilitas');
}

const usageRef = (id: string) => ({
  usedInTable: 'GalleryItem',
  usedInId: id,
  usedInField: 'photoSrc',
});

export async function createGalleryItemAction(raw: unknown): Promise<ActionResult<GalleryItem>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    const input = galleryItemInputSchema.parse(raw) as GalleryItemInput;
    const created = await createGalleryItem(input);
    await syncPhotoUsage(null, created.photo, usageRef(created.id));
    await writeAudit({ userId: user.id, action: 'create_gallery_item', target: `gallery:${created.id}` }).catch(() => {});
    revalidateGallery();
    return created;
  });
}

export async function updateGalleryItemAction(id: string, raw: unknown): Promise<ActionResult<GalleryItem>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    const input = galleryItemInputSchema.parse(raw) as GalleryItemInput;
    const prev = await getGalleryItemById(id);
    const updated = await updateGalleryItem(id, input);
    await syncPhotoUsage(prev?.photo ?? null, updated.photo, usageRef(id));
    await writeAudit({ userId: user.id, action: 'update_gallery_item', target: `gallery:${id}` }).catch(() => {});
    revalidateGallery();
    return updated;
  });
}

export async function deleteGalleryItemAction(id: string): Promise<ActionResult<void>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    const prev = await getGalleryItemById(id);
    await deleteGalleryItem(id);
    await syncPhotoUsage(prev?.photo ?? null, null, usageRef(id));
    await writeAudit({ userId: user.id, action: 'delete_gallery_item', target: `gallery:${id}` }).catch(() => {});
    revalidateGallery();
  });
}

export async function reorderGalleryItemsAction(orderedIds: string[]): Promise<ActionResult<void>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    await reorderGalleryItems(orderedIds);
    await writeAudit({ userId: user.id, action: 'reorder_gallery_item', target: 'gallery:*' }).catch(() => {});
    revalidateGallery();
  });
}
