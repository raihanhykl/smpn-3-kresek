import { prisma } from '@/lib/db/client';
import { createMediaAsset, deleteMediaAsset } from '@/lib/data/repositories/media-repo';
import { linkMediaUsage, unlinkMediaUsage } from '@/lib/media/link-usage';

function input(o: Partial<Parameters<typeof createMediaAsset>[0]> = {}): Parameters<typeof createMediaAsset>[0] {
  return {
    kind: 'image',
    url: 'https://res.cloudinary.com/test-cloud/image/upload/v1/x.jpg',
    publicId: 'smpn3kresek/image/' + Math.random().toString(36).slice(2, 10),
    hash: Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
    alt: null,
    filename: 'x.jpg',
    sizeBytes: 1024,
    mimeType: 'image/jpeg',
    width: null,
    height: null,
    uploadedBy: 'test-user',
    ...o,
  };
}

describe('linkMediaUsage / unlinkMediaUsage (Phase 3)', () => {
  beforeEach(async () => { await prisma.mediaAsset.deleteMany({}); });
  afterAll(async () => { await prisma.mediaAsset.deleteMany({}); await prisma.$disconnect(); });

  it('links a usage row once; linking the same composite again is a no-op', async () => {
    const media = await createMediaAsset(input());
    await linkMediaUsage({ mediaId: media.id, usedInTable: 'Teacher', usedInId: 't1', usedInField: 'photoSrc' });
    await linkMediaUsage({ mediaId: media.id, usedInTable: 'Teacher', usedInId: 't1', usedInField: 'photoSrc' });
    expect(
      await prisma.mediaUsage.count({ where: { mediaId: media.id } }),
    ).toBe(1);
  });

  it('different (table, id, field) tuples coexist on the same media', async () => {
    const media = await createMediaAsset(input());
    await linkMediaUsage({ mediaId: media.id, usedInTable: 'Teacher', usedInId: 't1', usedInField: 'photoSrc' });
    await linkMediaUsage({ mediaId: media.id, usedInTable: 'DocumentSlot', usedInId: 'kalender-akademik', usedInField: 'mediaId' });
    expect(await prisma.mediaUsage.count({ where: { mediaId: media.id } })).toBe(2);
  });

  it('unlink removes a specific composite without touching others', async () => {
    const media = await createMediaAsset(input());
    await linkMediaUsage({ mediaId: media.id, usedInTable: 'Teacher', usedInId: 't1', usedInField: 'photoSrc' });
    await linkMediaUsage({ mediaId: media.id, usedInTable: 'Teacher', usedInId: 't2', usedInField: 'photoSrc' });
    await unlinkMediaUsage({ mediaId: media.id, usedInTable: 'Teacher', usedInId: 't1', usedInField: 'photoSrc' });
    const remaining = await prisma.mediaUsage.findMany({ where: { mediaId: media.id } });
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.usedInId).toBe('t2');
  });

  it('unlink when nothing is linked is a silent no-op (idempotent)', async () => {
    const media = await createMediaAsset(input());
    await expect(
      unlinkMediaUsage({ mediaId: media.id, usedInTable: 'Teacher', usedInId: 'nope', usedInField: 'photoSrc' }),
    ).resolves.toBeUndefined();
  });

  it('deleting the MediaAsset cascades and removes all its usage rows', async () => {
    const media = await createMediaAsset(input());
    await linkMediaUsage({ mediaId: media.id, usedInTable: 'A', usedInId: '1', usedInField: 'f' });
    await linkMediaUsage({ mediaId: media.id, usedInTable: 'B', usedInId: '2', usedInField: 'g' });
    await deleteMediaAsset(media.id);
    expect(await prisma.mediaUsage.count({ where: { mediaId: media.id } })).toBe(0);
  });
});
