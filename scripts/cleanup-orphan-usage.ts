/* eslint-disable no-console */
// One-time (idempotent) cleanup of orphan MediaUsage rows — usage records whose owner
// no longer references the photo (e.g. a Mading post reseeded to images:[]). Safe to
// re-run. Run on dev + once on prod after deploy:  npx tsx scripts/cleanup-orphan-usage.ts
import { prisma } from '../src/lib/db/client';

async function stillReferenced(
  usedInTable: string, usedInId: string, usedInField: string, mediaId: string, publicId: string,
): Promise<boolean> {
  switch (usedInTable) {
    case 'Teacher': return (await prisma.teacher.findUnique({ where: { id: usedInId }, select: { photoSrc: true } }))?.photoSrc === publicId;
    case 'Achievement': return (await prisma.achievement.findUnique({ where: { id: usedInId }, select: { photoSrc: true } }))?.photoSrc === publicId;
    case 'Extracurricular': return (await prisma.extracurricular.findUnique({ where: { id: usedInId }, select: { photoSrc: true } }))?.photoSrc === publicId;
    case 'GalleryItem': return (await prisma.galleryItem.findUnique({ where: { id: usedInId }, select: { photoSrc: true } }))?.photoSrc === publicId;
    case 'Facility': return (await prisma.facility.findUnique({ where: { id: usedInId }, select: { photoSrc: true } }))?.photoSrc === publicId;
    case 'Mading': {
      const m = await prisma.mading.findUnique({ where: { id: usedInId }, select: { images: true } });
      const imgs = (m?.images as Array<{ src: string }> | null) ?? [];
      const idx = Number.parseInt(usedInField.replace('image:', ''), 10);
      return !!imgs[idx] && imgs[idx]!.src === publicId;
    }
    case 'SectionPhoto': {
      const parts = usedInId.split(':');
      const pageKey = parts[0]; const sectionKey = parts[1]; const field = parts[2];
      if (!pageKey || !sectionKey || !field) return false;
      const sp = await prisma.sectionPhoto.findUnique({
        where: { pageKey_sectionKey_field: { pageKey, sectionKey, field } }, select: { photoSrc: true },
      });
      return sp?.photoSrc === publicId;
    }
    case 'DocumentSlot': {
      const slot = await prisma.documentSlot.findUnique({ where: { id: usedInId }, select: { mediaId: true } });
      return slot?.mediaId === mediaId;
    }
    default: return true; // unknown table — keep, don't risk deleting a real usage
  }
}

async function main() {
  const rows = await prisma.mediaUsage.findMany();
  const orphanIds: string[] = [];
  for (const u of rows) {
    const media = await prisma.mediaAsset.findUnique({ where: { id: u.mediaId }, select: { publicId: true } });
    if (!media) { orphanIds.push(u.id); continue; }
    const ok = await stillReferenced(u.usedInTable, u.usedInId, u.usedInField, u.mediaId, media.publicId);
    if (!ok) orphanIds.push(u.id);
  }
  if (orphanIds.length === 0) { console.log('No orphan MediaUsage rows.'); return; }
  await prisma.mediaUsage.deleteMany({ where: { id: { in: orphanIds } } });
  console.log(`Removed ${orphanIds.length} orphan MediaUsage row(s):`, orphanIds);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
