import { prisma } from '@/lib/db/client';
import type { Photo } from '@config/types';
import { syncPhotoUsage } from '@/lib/media/sync-photo-usage';
import { createMediaAsset } from '@/lib/data/repositories/media-repo';

function pdfInput(seed: number, kind: 'image' | 'pdf' = 'image'): Parameters<typeof createMediaAsset>[0] {
  const hex = seed.toString(16).padStart(64, '0');
  const pid = `smpn3kresek/${kind}/seed-${seed}`;
  return {
    kind,
    url: `https://res.cloudinary.com/test-cloud/${kind === 'pdf' ? 'raw' : 'image'}/upload/v1/${pid}.${kind === 'pdf' ? 'pdf' : 'jpg'}`,
    publicId: pid,
    hash: hex,
    alt: null, filename: `f${seed}`, sizeBytes: 1024,
    mimeType: kind === 'pdf' ? 'application/pdf' : 'image/jpeg',
    width: null, height: null, uploadedBy: 'seed',
  };
}

const gradient: Photo = { kind: 'gradient', from: '#000', to: '#fff', emoji: '👤' };
const ref = { usedInTable: 'Teacher', usedInId: 't-fake', usedInField: 'photoSrc' };

describe('syncPhotoUsage', () => {
  beforeEach(async () => {
    await prisma.mediaUsage.deleteMany({});
    await prisma.mediaAsset.deleteMany({});
  });
  afterAll(async () => {
    await prisma.mediaUsage.deleteMany({});
    await prisma.mediaAsset.deleteMany({});
    await prisma.$disconnect();
  });

  it('gradient → gradient: no-op (no usage rows touched)', async () => {
    await syncPhotoUsage(gradient, gradient, ref);
    expect(await prisma.mediaUsage.count()).toBe(0);
  });

  it('gradient → url: links the new usage', async () => {
    const m = await createMediaAsset(pdfInput(1));
    const url: Photo = { kind: 'url', src: m.publicId, alt: 'x' };
    await syncPhotoUsage(gradient, url, ref);
    const usage = await prisma.mediaUsage.findMany({ where: ref });
    expect(usage).toHaveLength(1);
    expect(usage[0]?.mediaId).toBe(m.id);
  });

  it('url → gradient: unlinks the previous usage', async () => {
    const m = await createMediaAsset(pdfInput(2));
    const url: Photo = { kind: 'url', src: m.publicId, alt: 'x' };
    await syncPhotoUsage(gradient, url, ref);
    expect(await prisma.mediaUsage.count({ where: ref })).toBe(1);
    await syncPhotoUsage(url, gradient, ref);
    expect(await prisma.mediaUsage.count({ where: ref })).toBe(0);
  });

  it('url → url(same): no-op (same publicId)', async () => {
    const m = await createMediaAsset(pdfInput(3));
    const url: Photo = { kind: 'url', src: m.publicId, alt: 'x' };
    await syncPhotoUsage(gradient, url, ref);
    await syncPhotoUsage(url, url, ref);
    expect(await prisma.mediaUsage.count({ where: ref })).toBe(1);
  });

  it('url → url(diff): unlinks prev + links next', async () => {
    const a = await createMediaAsset(pdfInput(4));
    const b = await createMediaAsset(pdfInput(5));
    const urlA: Photo = { kind: 'url', src: a.publicId, alt: 'a' };
    const urlB: Photo = { kind: 'url', src: b.publicId, alt: 'b' };
    await syncPhotoUsage(gradient, urlA, ref);
    await syncPhotoUsage(urlA, urlB, ref);
    const usage = await prisma.mediaUsage.findMany({ where: ref });
    expect(usage).toHaveLength(1);
    expect(usage[0]?.mediaId).toBe(b.id);
  });

  it('null → url (create): links new', async () => {
    const m = await createMediaAsset(pdfInput(6));
    const url: Photo = { kind: 'url', src: m.publicId, alt: 'x' };
    await syncPhotoUsage(null, url, ref);
    expect(await prisma.mediaUsage.count({ where: ref })).toBe(1);
  });

  it('url → null (delete): unlinks prev', async () => {
    const m = await createMediaAsset(pdfInput(7));
    const url: Photo = { kind: 'url', src: m.publicId, alt: 'x' };
    await syncPhotoUsage(null, url, ref);
    await syncPhotoUsage(url, null, ref);
    expect(await prisma.mediaUsage.count({ where: ref })).toBe(0);
  });

  it('null → null: no-op', async () => {
    await syncPhotoUsage(null, null, ref);
    expect(await prisma.mediaUsage.count()).toBe(0);
  });

  it('url → url with deleted MediaAsset row: silently skips (no crash)', async () => {
    const phantomUrl: Photo = { kind: 'url', src: 'smpn3kresek/image/phantom', alt: 'x' };
    // No MediaAsset row exists for phantom — should not crash.
    await expect(syncPhotoUsage(phantomUrl, gradient, ref)).resolves.toBeUndefined();
    expect(await prisma.mediaUsage.count()).toBe(0);
  });
});
