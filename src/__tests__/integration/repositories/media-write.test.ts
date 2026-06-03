import { prisma } from '@/lib/db/client';
import {
  createMediaAsset, deleteMediaAsset, getMediaAssetByHash, getMediaAssetById,
  getMediaAssetUsage, listMediaAssets,
} from '@/lib/data/repositories/media-repo';

function input(overrides: Partial<Parameters<typeof createMediaAsset>[0]> = {}): Parameters<typeof createMediaAsset>[0] {
  return {
    kind: 'image',
    url: 'https://res.cloudinary.com/test-cloud/image/upload/v1/smpn3kresek/image/abc.jpg',
    publicId: 'smpn3kresek/image/abc-' + Math.random().toString(36).slice(2, 10),
    hash: Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
    alt: 'sample',
    filename: 'sample.jpg',
    sizeBytes: 1024,
    mimeType: 'image/jpeg',
    width: 800,
    height: 600,
    uploadedBy: 'test-user',
    ...overrides,
  };
}

describe('media-repo (Phase 3)', () => {
  beforeEach(async () => {
    // MediaUsage has FK to MediaAsset (Cascade); clearing MediaAsset is enough.
    await prisma.mediaAsset.deleteMany({});
  });
  afterAll(async () => {
    await prisma.mediaAsset.deleteMany({});
    await prisma.$disconnect();
  });

  it('roundtrip create + getById + getByHash + delete; toPublic strips uploadedBy', async () => {
    const created = await createMediaAsset(input());
    expect(created.id).toBeTruthy();
    expect(created).not.toHaveProperty('uploadedBy');
    const byId = await getMediaAssetById(created.id);
    expect(byId?.id).toBe(created.id);
    const byHash = await getMediaAssetByHash(created.publicId === byId?.publicId ? (await prisma.mediaAsset.findUnique({ where: { id: created.id } }))!.hash : '');
    expect(byHash?.id).toBe(created.id);
    await deleteMediaAsset(created.id);
    expect(await prisma.mediaAsset.findUnique({ where: { id: created.id } })).toBeNull();
  });

  it('duplicate hash insert returns the EXISTING row (no exception bubbled)', async () => {
    const first = await createMediaAsset(input({ filename: 'first.jpg' }));
    // Same hash, different publicId — Prisma's UNIQUE(hash) fires before publicId.
    const second = await createMediaAsset(input({ hash: (await prisma.mediaAsset.findUnique({ where: { id: first.id } }))!.hash, publicId: 'smpn3kresek/image/different', filename: 'second.jpg' }));
    expect(second.id).toBe(first.id);
    expect(second.filename).toBe('first.jpg'); // original wins
    expect(await prisma.mediaAsset.count()).toBe(1);
  });

  it('duplicate publicId insert (rare) also returns the existing row', async () => {
    const first = await createMediaAsset(input());
    const sharedPublicId = (await prisma.mediaAsset.findUnique({ where: { id: first.id } }))!.publicId;
    const second = await createMediaAsset(input({ publicId: sharedPublicId, filename: 'race.jpg' }));
    expect(second.id).toBe(first.id);
    expect(await prisma.mediaAsset.count()).toBe(1);
  });

  it('deleting a MediaAsset cascades MediaUsage rows (FK onDelete: Cascade)', async () => {
    const created = await createMediaAsset(input());
    await prisma.mediaUsage.create({
      data: { mediaId: created.id, usedInTable: 'Teacher', usedInId: 't1', usedInField: 'photoSrc' },
    });
    await deleteMediaAsset(created.id);
    expect(await prisma.mediaUsage.count({ where: { mediaId: created.id } })).toBe(0);
  });

  it('listMediaAssets respects kind filter and pages by keyset cursor', async () => {
    // Seed 5 images + 3 pdfs in a known order.
    for (let i = 0; i < 5; i++) await createMediaAsset(input({ kind: 'image', filename: `img-${i}.jpg` }));
    for (let i = 0; i < 3; i++) await createMediaAsset(input({ kind: 'pdf', mimeType: 'application/pdf', filename: `doc-${i}.pdf` }));

    const onlyImages = await listMediaAssets({ kind: 'image' });
    expect(onlyImages.items).toHaveLength(5);
    expect(onlyImages.items.every((m) => m.kind === 'image')).toBe(true);

    // 8 rows total (5 image + 3 pdf). limit=3 → page1 (3, more) + page2 (3,
    // more) + page3 (2, no nextCursor). All ids must be unique across pages.
    const page1 = await listMediaAssets({ limit: 3 });
    expect(page1.items).toHaveLength(3);
    expect(page1.nextCursor).toBeTruthy();
    const page2 = await listMediaAssets({ limit: 3, cursor: page1.nextCursor! });
    expect(page2.items).toHaveLength(3);
    expect(page2.nextCursor).toBeTruthy();
    const page3 = await listMediaAssets({ limit: 3, cursor: page2.nextCursor! });
    expect(page3.items).toHaveLength(2);
    expect(page3.nextCursor).toBeNull();
    const seen = new Set<string>();
    for (const m of [...page1.items, ...page2.items, ...page3.items]) {
      expect(seen.has(m.id)).toBe(false);
      seen.add(m.id);
    }
    expect(seen.size).toBe(8);
  });

  it('getMediaAssetUsage returns a stable, ordered usage list', async () => {
    const created = await createMediaAsset(input());
    await prisma.mediaUsage.createMany({
      data: [
        { mediaId: created.id, usedInTable: 'Teacher', usedInId: 't2', usedInField: 'photoSrc' },
        { mediaId: created.id, usedInTable: 'DocumentSlot', usedInId: 'kalender-akademik', usedInField: 'mediaId' },
      ],
    });
    const usage = await getMediaAssetUsage(created.id);
    expect(usage).toHaveLength(2);
    // Ordered by table then id.
    expect(usage[0]?.usedInTable).toBe('DocumentSlot');
    expect(usage[1]?.usedInTable).toBe('Teacher');
  });
});
