import { prisma } from '@/lib/db/client';
import { createMediaAsset } from '@/lib/data/repositories/media-repo';

const mockSession = { user: { id: 'mading-actions-test', role: 'ADMIN' as const } };
jest.mock('@/lib/auth/session', () => ({
  getSession: jest.fn(async () => mockSession),
}));
const revalidateTagMock = jest.fn();
jest.mock('next/cache', () => ({
  unstable_cache: <T extends (...a: unknown[]) => unknown>(fn: T) => fn,
  revalidateTag: (...args: unknown[]) => revalidateTagMock(...args),
  revalidatePath: jest.fn(),
}));

import {
  createMadingAction, updateMadingAction, deleteMadingAction,
} from '@/app/(admin)/admin/entities/_actions/mading-actions';

function mediaInput(seed: number): Parameters<typeof createMediaAsset>[0] {
  const hex = seed.toString(16).padStart(64, '0');
  const pid = `smpn3kresek/image/mad-${seed}`;
  return {
    kind: 'image',
    url: `https://res.cloudinary.com/test-cloud/image/upload/v1/${pid}.jpg`,
    publicId: pid, hash: hex, alt: null, filename: `f${seed}`, sizeBytes: 1024,
    mimeType: 'image/jpeg', width: null, height: null, uploadedBy: 'seed',
  };
}

const usageCount = (usedInId: string) =>
  prisma.mediaUsage.count({ where: { usedInTable: 'Mading', usedInId } });

describe('mading server actions', () => {
  const madingIds: string[] = [];
  let pidA = '', pidB = '';

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { id: 'mading-actions-test' } });
    await prisma.user.create({ data: { id: 'mading-actions-test', email: 'mat@test.local', passwordHash: 'x', name: 'MAT', role: 'ADMIN' } });
    const a = await createMediaAsset(mediaInput(901));
    const b = await createMediaAsset(mediaInput(902));
    pidA = a.publicId; pidB = b.publicId;
  });
  afterEach(() => { revalidateTagMock.mockClear(); });
  afterAll(async () => {
    await prisma.mediaUsage.deleteMany({ where: { usedInTable: 'Mading' } });
    await prisma.mading.deleteMany({ where: { id: { in: madingIds } } });
    await prisma.mediaAsset.deleteMany({ where: { publicId: { in: [pidA, pidB] } } });
    await prisma.auditLog.deleteMany({ where: { userId: 'mading-actions-test' } });
    await prisma.user.deleteMany({ where: { id: 'mading-actions-test' } });
    await prisma.$disconnect();
  });

  it('create links one MediaUsage per image + revalidates mading', async () => {
    const res = await createMadingAction({ title: 'T', images: [{ src: pidA, alt: 'a' }] });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    madingIds.push(res.data.id);
    expect(await usageCount(res.data.id)).toBe(1);
    expect(revalidateTagMock).toHaveBeenCalledWith('mading');
  });

  it('update diff adds + removes image usages by slot', async () => {
    const res = await createMadingAction({ title: 'T2', images: [{ src: pidA, alt: 'a' }] });
    expect(res.ok).toBe(true); if (!res.ok) return;
    const id = res.data.id; madingIds.push(id);
    expect(await usageCount(id)).toBe(1);

    // add a second image -> 2 usages (image:0, image:1)
    const up1 = await updateMadingAction(id, { title: 'T2', images: [{ src: pidA, alt: 'a' }, { src: pidB, alt: 'b' }] });
    expect(up1.ok).toBe(true);
    expect(await usageCount(id)).toBe(2);

    // shrink to only the second image -> slot image:0 now points at B, image:1 removed -> 1 usage
    const up2 = await updateMadingAction(id, { title: 'T2', images: [{ src: pidB, alt: 'b' }] });
    expect(up2.ok).toBe(true);
    expect(await usageCount(id)).toBe(1);
  });

  it('delete removes all image usages', async () => {
    const res = await createMadingAction({ title: 'T3', images: [{ src: pidA, alt: 'a' }, { src: pidB, alt: 'b' }] });
    expect(res.ok).toBe(true); if (!res.ok) return;
    const id = res.data.id;
    expect(await usageCount(id)).toBe(2);
    const del = await deleteMadingAction(id);
    expect(del.ok).toBe(true);
    expect(await usageCount(id)).toBe(0);
  });

  it('rejects invalid input (empty title) with typed error', async () => {
    const res = await createMadingAction({ title: '', images: [{ src: pidA, alt: 'a' }] });
    expect(res.ok).toBe(false);
  });
});
