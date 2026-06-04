import { prisma } from '@/lib/db/client';
import { createMediaAsset } from '@/lib/data/repositories/media-repo';

const mockSession = { user: { id: 'media-del-test', role: 'ADMIN' as const } };
jest.mock('@/lib/auth/session', () => ({ getSession: jest.fn(async () => mockSession) }));
jest.mock('next/cache', () => ({
  unstable_cache: <T extends (...a: unknown[]) => unknown>(fn: T) => fn,
  revalidateTag: jest.fn(),
  revalidatePath: jest.fn(),
}));

// Mock the destroy helper so we can assert args + simulate not_found / error.
const destroyMock = jest.fn<Promise<'destroyed' | 'not_found'>, unknown[]>(
  async () => 'destroyed' as const,
);
jest.mock('@/lib/media/cloudinary-destroy', () => ({
  destroyCloudinaryAsset: (...args: unknown[]) => destroyMock(...args),
}));

import { deleteMediaAction } from '@/app/(admin)/admin/media/_actions/media-actions';

function mediaInput(seed: number, kind: 'image' | 'pdf') {
  const hex = seed.toString(16).padStart(64, '0');
  const ext = kind === 'pdf' ? '.pdf' : '';
  const pid = `smpn3kresek/${kind === 'pdf' ? 'pdf' : 'image'}/del-${seed}${ext}`;
  return {
    kind, url: `https://res.cloudinary.com/c/${kind === 'pdf' ? 'raw' : 'image'}/upload/v1/${pid}`,
    publicId: pid, hash: hex, alt: null, filename: `f${seed}`, sizeBytes: 1024,
    mimeType: kind === 'pdf' ? 'application/pdf' : 'image/jpeg', width: null, height: null,
    uploadedBy: 'seed',
  };
}

describe('deleteMediaAction + Cloudinary destroy', () => {
  const ids: string[] = [];
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { id: 'media-del-test' } });
    await prisma.user.create({ data: { id: 'media-del-test', email: 'mdt@test.local', passwordHash: 'x', name: 'MDT', role: 'ADMIN' } });
  });
  beforeEach(() => destroyMock.mockClear());
  afterAll(async () => {
    await prisma.mediaUsage.deleteMany({ where: { usedInTable: 'TestOwner' } });
    await prisma.mediaAsset.deleteMany({ where: { id: { in: ids } } });
    // deleteMediaAction writes an AuditLog row (FK to User is onDelete: Restrict),
    // so clear those before removing the test user.
    await prisma.auditLog.deleteMany({ where: { userId: 'media-del-test' } });
    await prisma.user.deleteMany({ where: { id: 'media-del-test' } });
    await prisma.$disconnect();
  });

  it('deletes an unused IMAGE: destroy(publicId, "image") then removes the row', async () => {
    const m = await createMediaAsset(mediaInput(801, 'image'));
    ids.push(m.id);
    const r = await deleteMediaAction(m.id);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual({ deleted: true });
    expect(destroyMock).toHaveBeenCalledWith(m.publicId, 'image');
    expect(await prisma.mediaAsset.findUnique({ where: { id: m.id } })).toBeNull();
  });

  it('deletes an unused PDF: destroy(extension-bearing publicId, "raw")', async () => {
    const m = await createMediaAsset(mediaInput(802, 'pdf'));
    ids.push(m.id);
    expect(m.publicId.endsWith('.pdf')).toBe(true);
    const r = await deleteMediaAction(m.id);
    expect(r.ok).toBe(true);
    expect(destroyMock).toHaveBeenCalledWith(m.publicId, 'raw');
  });

  it('refuses an in-use asset: returns usage, does NOT destroy or delete', async () => {
    const m = await createMediaAsset(mediaInput(803, 'image'));
    ids.push(m.id);
    await prisma.mediaUsage.create({ data: { mediaId: m.id, usedInTable: 'TestOwner', usedInId: 'x', usedInField: 'photoSrc' } });
    const r = await deleteMediaAction(m.id);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.deleted).toBe(false);
    expect(destroyMock).not.toHaveBeenCalled();
    expect(await prisma.mediaAsset.findUnique({ where: { id: m.id } })).not.toBeNull();
  });

  it('not_found from destroy still removes the DB row', async () => {
    const m = await createMediaAsset(mediaInput(804, 'image'));
    ids.push(m.id);
    destroyMock.mockResolvedValueOnce('not_found' as const);
    const r = await deleteMediaAction(m.id);
    expect(r.ok).toBe(true);
    expect(await prisma.mediaAsset.findUnique({ where: { id: m.id } })).toBeNull();
  });

  it('a thrown destroy error keeps the DB row and returns ok:false', async () => {
    const m = await createMediaAsset(mediaInput(805, 'image'));
    ids.push(m.id);
    destroyMock.mockRejectedValueOnce(new Error('network'));
    const r = await deleteMediaAction(m.id);
    expect(r.ok).toBe(false);
    expect(await prisma.mediaAsset.findUnique({ where: { id: m.id } })).not.toBeNull();
  });
});
