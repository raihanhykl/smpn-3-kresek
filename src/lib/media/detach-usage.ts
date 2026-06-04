import { prisma } from '@/lib/db/client';
import type { Prisma } from '@prisma/client';
import { photoToColumns } from '@/lib/data/repositories/_photo-columns';
import { reconcileMadingImageUsages } from '@/lib/media/mading-usage';
import type { Photo } from '@config/types';

export type UsageRow = { usedInTable: string; usedInId: string; usedInField: string };

const PLACEHOLDER: Photo = { kind: 'gradient', from: '#DBEAFE', to: '#93C5FD', emoji: '🖼️' };
const ENTITY_TABLES = new Set(['Teacher', 'Achievement', 'Extracurricular', 'GalleryItem', 'Facility']);

async function entityFindPhotoSrc(table: string, id: string): Promise<{ photoSrc: string | null } | null> {
  switch (table) {
    case 'Teacher': return prisma.teacher.findUnique({ where: { id }, select: { photoSrc: true } });
    case 'Achievement': return prisma.achievement.findUnique({ where: { id }, select: { photoSrc: true } });
    case 'Extracurricular': return prisma.extracurricular.findUnique({ where: { id }, select: { photoSrc: true } });
    case 'GalleryItem': return prisma.galleryItem.findUnique({ where: { id }, select: { photoSrc: true } });
    case 'Facility': return prisma.facility.findUnique({ where: { id }, select: { photoSrc: true } });
    default: return null;
  }
}

export async function detachMediaUsage(
  publicId: string,
  mediaId: string,
  row: UsageRow,
): Promise<'detached' | 'unlinked-orphan' | 'noop'> {
  const where = { mediaId, usedInTable: row.usedInTable, usedInId: row.usedInId, usedInField: row.usedInField };

  if (ENTITY_TABLES.has(row.usedInTable)) {
    const ent = await entityFindPhotoSrc(row.usedInTable, row.usedInId);
    if (!ent || ent.photoSrc !== publicId) {
      const del = await prisma.mediaUsage.deleteMany({ where });
      return del.count > 0 ? 'unlinked-orphan' : 'noop';
    }
    // photoToColumns(PLACEHOLDER) is the shared 10-column shape every entity owns;
    // the per-table delegates accept it but each has a distinct UpdateInput type,
    // so a localized cast per case keeps the union out of .update() (which won't typecheck).
    const cols = photoToColumns(PLACEHOLDER);
    const usageDelete = prisma.mediaUsage.deleteMany({ where });
    switch (row.usedInTable) {
      case 'Teacher':
        await prisma.$transaction([prisma.teacher.update({ where: { id: row.usedInId }, data: cols as Prisma.TeacherUpdateInput }), usageDelete]); break;
      case 'Achievement':
        await prisma.$transaction([prisma.achievement.update({ where: { id: row.usedInId }, data: cols as Prisma.AchievementUpdateInput }), usageDelete]); break;
      case 'Extracurricular':
        await prisma.$transaction([prisma.extracurricular.update({ where: { id: row.usedInId }, data: cols as Prisma.ExtracurricularUpdateInput }), usageDelete]); break;
      case 'GalleryItem':
        await prisma.$transaction([prisma.galleryItem.update({ where: { id: row.usedInId }, data: cols as Prisma.GalleryItemUpdateInput }), usageDelete]); break;
      case 'Facility':
        await prisma.$transaction([prisma.facility.update({ where: { id: row.usedInId }, data: cols as Prisma.FacilityUpdateInput }), usageDelete]); break;
    }
    return 'detached';
  }

  if (row.usedInTable === 'Mading') {
    const m = await prisma.mading.findUnique({ where: { id: row.usedInId }, select: { images: true } });
    const prevImgs = ((m?.images as Array<{ src: string; alt: string }> | null) ?? []);
    const idx = Number.parseInt(row.usedInField.replace('image:', ''), 10);
    if (!m || !prevImgs[idx] || prevImgs[idx]!.src !== publicId) {
      const del = await prisma.mediaUsage.deleteMany({ where });
      return del.count > 0 ? 'unlinked-orphan' : 'noop';
    }
    const nextImgs = prevImgs.filter((_, i) => i !== idx);
    await prisma.mading.update({
      where: { id: row.usedInId },
      data: { images: nextImgs as unknown as Prisma.InputJsonValue },
    });
    await reconcileMadingImageUsages(row.usedInId, prevImgs, nextImgs);
    return 'detached';
  }

  if (row.usedInTable === 'SectionPhoto') {
    const parts = row.usedInId.split(':');
    const pageKey = parts[0]; const sectionKey = parts[1]; const field = parts[2];
    if (!pageKey || !sectionKey || !field) {
      const del = await prisma.mediaUsage.deleteMany({ where });
      return del.count > 0 ? 'unlinked-orphan' : 'noop';
    }
    const sp = await prisma.sectionPhoto.findUnique({
      where: { pageKey_sectionKey_field: { pageKey, sectionKey, field } },
      select: { photoSrc: true },
    });
    if (!sp || sp.photoSrc !== publicId) {
      const del = await prisma.mediaUsage.deleteMany({ where });
      return del.count > 0 ? 'unlinked-orphan' : 'noop';
    }
    await prisma.$transaction([
      prisma.sectionPhoto.deleteMany({ where: { pageKey, sectionKey, field } }),
      prisma.mediaUsage.deleteMany({ where }),
    ]);
    return 'detached';
  }

  if (row.usedInTable === 'DocumentSlot') {
    const slot = await prisma.documentSlot.findUnique({ where: { id: row.usedInId }, select: { mediaId: true } });
    if (!slot || slot.mediaId !== mediaId) {
      const del = await prisma.mediaUsage.deleteMany({ where });
      return del.count > 0 ? 'unlinked-orphan' : 'noop';
    }
    await prisma.$transaction([
      prisma.documentSlot.update({ where: { id: row.usedInId }, data: { mediaId: null } }),
      prisma.mediaUsage.deleteMany({ where }),
    ]);
    return 'detached';
  }

  const del = await prisma.mediaUsage.deleteMany({ where });
  return del.count > 0 ? 'unlinked-orphan' : 'noop';
}
