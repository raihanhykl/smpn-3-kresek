import { prisma } from '@/lib/db/client';
import { createMediaAsset } from '@/lib/data/repositories/media-repo';
import { getDocumentSlotWithMedia } from '@/lib/data/repositories/document-slot-repo';

describe('getDocumentSlotWithMedia (Phase 3 join)', () => {
  beforeEach(async () => {
    await prisma.documentSlot.deleteMany({});
    await prisma.mediaAsset.deleteMany({});
  });
  afterAll(async () => {
    await prisma.documentSlot.deleteMany({});
    await prisma.mediaAsset.deleteMany({});
    await prisma.$disconnect();
  });

  it('returns null for an unknown slot id', async () => {
    const slot = await getDocumentSlotWithMedia('does-not-exist');
    expect(slot).toBeNull();
  });

  it('returns { id, media: null } when the slot exists but has no PDF', async () => {
    await prisma.documentSlot.create({ data: { id: 'kalender-akademik' } });
    const slot = await getDocumentSlotWithMedia('kalender-akademik');
    expect(slot).toEqual({ id: 'kalender-akademik', media: null });
  });

  it('returns the full PublicMediaAsset projection when a PDF is linked', async () => {
    const m = await createMediaAsset({
      kind: 'pdf',
      url: 'https://res.cloudinary.com/test-cloud/raw/upload/v1/x.pdf',
      publicId: 'smpn3kresek/pdf/x',
      hash: 'f'.repeat(64),
      alt: null, filename: 'x.pdf', sizeBytes: 1024, mimeType: 'application/pdf',
      width: null, height: null, uploadedBy: 'seed',
    });
    await prisma.documentSlot.create({ data: { id: 'kalender-akademik', mediaId: m.id } });
    const slot = await getDocumentSlotWithMedia('kalender-akademik');
    expect(slot).not.toBeNull();
    expect(slot!.id).toBe('kalender-akademik');
    expect(slot!.media).not.toBeNull();
    expect(slot!.media!.publicId).toBe('smpn3kresek/pdf/x');
    expect(slot!.media!.kind).toBe('pdf');
  });
});
