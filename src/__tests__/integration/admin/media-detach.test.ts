import { prisma } from '@/lib/db/client';
import { createMediaAsset } from '@/lib/data/repositories/media-repo';

const mockSession = { user: { id: 'media-detach-test', role: 'ADMIN' as const } };
jest.mock('@/lib/auth/session', () => ({ getSession: jest.fn(async () => mockSession) }));
jest.mock('next/cache', () => ({
  unstable_cache: <T extends (...a: unknown[]) => unknown>(fn: T) => fn,
  revalidateTag: jest.fn(),
  revalidatePath: jest.fn(),
}));
jest.mock('@/lib/media/cloudinary-destroy', () => ({
  destroyCloudinaryAsset: jest.fn(async () => 'destroyed' as const),
}));

import { detachMediaUsageAction, deleteMediaAction } from '@/app/(admin)/admin/media/_actions/media-actions';

function mediaInput(seed: number) {
  const hex = seed.toString(16).padStart(64, '0');
  const pid = `smpn3kresek/image/detach-${seed}`;
  return {
    kind: 'image' as const, url: `https://res.cloudinary.com/c/image/upload/v1/${pid}`,
    publicId: pid, hash: hex, alt: null, filename: `f${seed}`, sizeBytes: 1, mimeType: 'image/jpeg',
    width: null, height: null, uploadedBy: 'seed',
  };
}
const usageCount = (mediaId: string) => prisma.mediaUsage.count({ where: { mediaId } });

describe('detachMediaUsageAction', () => {
  const cleanupIds: string[] = [];
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { id: 'media-detach-test' } });
    await prisma.user.create({ data: { id: 'media-detach-test', email: 'mdt2@test.local', passwordHash: 'x', name: 'MDT2', role: 'ADMIN' } });
  });
  afterAll(async () => {
    await prisma.mediaUsage.deleteMany({ where: { usedInId: { in: ['detach-m1', 'detach-m2', 'detach-t1'] } } });
    await prisma.mading.deleteMany({ where: { id: { in: ['detach-m1', 'detach-m2'] } } });
    await prisma.teacher.deleteMany({ where: { id: 'detach-t1' } });
    await prisma.mediaAsset.deleteMany({ where: { id: { in: cleanupIds } } });
    await prisma.auditLog.deleteMany({ where: { userId: 'media-detach-test' } });
    await prisma.user.deleteMany({ where: { id: 'media-detach-test' } });
    await prisma.$disconnect();
  });

  it('Mading: detaches an image, removing it from the post + the usage row, then deletable', async () => {
    const m = await createMediaAsset(mediaInput(901)); cleanupIds.push(m.id);
    await prisma.mading.create({ data: { id: 'detach-m1', title: 'T', images: [{ src: m.publicId, alt: 'a' }] as object, order: 0 } });
    await prisma.mediaUsage.create({ data: { mediaId: m.id, usedInTable: 'Mading', usedInId: 'detach-m1', usedInField: 'image:0' } });
    const r = await detachMediaUsageAction({ mediaId: m.id, usedInTable: 'Mading', usedInId: 'detach-m1', usedInField: 'image:0' });
    expect(r.ok).toBe(true);
    expect(await usageCount(m.id)).toBe(0);
    const post = await prisma.mading.findUnique({ where: { id: 'detach-m1' } });
    expect((post!.images as unknown[]).length).toBe(0);
    const del = await deleteMediaAction(m.id);
    expect(del.ok && del.data.deleted).toBe(true);
  });

  it('Mading ORPHAN (post already empty) → removes the stale usage row (the live bug)', async () => {
    const m = await createMediaAsset(mediaInput(902)); cleanupIds.push(m.id);
    await prisma.mading.create({ data: { id: 'detach-m2', title: 'T', images: [] as object, order: 0 } });
    await prisma.mediaUsage.create({ data: { mediaId: m.id, usedInTable: 'Mading', usedInId: 'detach-m2', usedInField: 'image:1' } });
    const r = await detachMediaUsageAction({ mediaId: m.id, usedInTable: 'Mading', usedInId: 'detach-m2', usedInField: 'image:1' });
    expect(r.ok).toBe(true);
    expect(await usageCount(m.id)).toBe(0);
  });

  it('Teacher: detach resets the photo to gradient + removes usage', async () => {
    const m = await createMediaAsset(mediaInput(903)); cleanupIds.push(m.id);
    await prisma.teacher.create({ data: { id: 'detach-t1', name: 'X', position: 'p', badge: 'b', category: 'guru', photoKind: 'url', photoSrc: m.publicId, photoAlt: 'a' } });
    await prisma.mediaUsage.create({ data: { mediaId: m.id, usedInTable: 'Teacher', usedInId: 'detach-t1', usedInField: 'photoSrc' } });
    const r = await detachMediaUsageAction({ mediaId: m.id, usedInTable: 'Teacher', usedInId: 'detach-t1', usedInField: 'photoSrc' });
    expect(r.ok).toBe(true);
    const t = await prisma.teacher.findUnique({ where: { id: 'detach-t1' } });
    expect(t!.photoKind).toBe('gradient');
    expect(t!.photoSrc).toBeNull();
    expect(await usageCount(m.id)).toBe(0);
  });

  it('rejects an unknown usedInTable via Zod', async () => {
    const r = await detachMediaUsageAction({ mediaId: 'x', usedInTable: 'Bogus', usedInId: 'y', usedInField: 'z' });
    expect(r.ok).toBe(false);
  });
});
