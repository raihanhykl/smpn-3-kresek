import { prisma } from '@/lib/db/client';
import { createMediaAsset } from '@/lib/data/repositories/media-repo';

jest.mock('@/lib/auth/session', () => ({ getSession: jest.fn() }));
import { getSession } from '@/lib/auth/session';
const mockSession = getSession as jest.Mock;

import { updateDocumentSlotAction } from '@/app/(admin)/admin/entities/_actions/document-slot-actions';

function pdfInput(seed: number): Parameters<typeof createMediaAsset>[0] {
  const hex = seed.toString(16).padStart(64, '0');
  return {
    kind: 'pdf',
    url: 'https://res.cloudinary.com/test-cloud/raw/upload/v1/x.pdf',
    publicId: `smpn3kresek/pdf/x${seed}`,
    hash: hex,
    alt: null, filename: 'x.pdf', sizeBytes: 1024, mimeType: 'application/pdf',
    width: null, height: null, uploadedBy: 'seed',
  };
}

describe('updateDocumentSlotAction', () => {
  beforeEach(async () => {
    mockSession.mockResolvedValue({ user: { id: 'admin-doc', role: 'ADMIN' } });
    await prisma.documentSlot.deleteMany({});
    await prisma.mediaUsage.deleteMany({});
    await prisma.mediaAsset.deleteMany({});
  });
  afterAll(async () => {
    await prisma.documentSlot.deleteMany({});
    await prisma.mediaAsset.deleteMany({});
    await prisma.$disconnect();
  });

  it('attaches a PDF to kalender-akademik and writes the MediaUsage link', async () => {
    const m = await createMediaAsset(pdfInput(1));
    const r = await updateDocumentSlotAction({ slotId: 'kalender-akademik', mediaId: m.id });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual({ slotId: 'kalender-akademik', mediaId: m.id });
    const row = await prisma.documentSlot.findUnique({ where: { id: 'kalender-akademik' } });
    expect(row?.mediaId).toBe(m.id);
    const usage = await prisma.mediaUsage.findMany({
      where: { mediaId: m.id, usedInTable: 'DocumentSlot', usedInId: 'kalender-akademik' },
    });
    expect(usage).toHaveLength(1);
  });

  it('replacing a PDF unlinks the old usage and links the new one', async () => {
    const m1 = await createMediaAsset(pdfInput(2));
    const m2 = await createMediaAsset(pdfInput(3));
    await updateDocumentSlotAction({ slotId: 'tata-tertib', mediaId: m1.id });
    await updateDocumentSlotAction({ slotId: 'tata-tertib', mediaId: m2.id });

    expect(await prisma.mediaUsage.findMany({ where: { mediaId: m1.id } })).toHaveLength(0);
    expect(await prisma.mediaUsage.findMany({ where: { mediaId: m2.id } })).toHaveLength(1);
    const row = await prisma.documentSlot.findUnique({ where: { id: 'tata-tertib' } });
    expect(row?.mediaId).toBe(m2.id);
  });

  it('detaches (mediaId=null) and removes the usage row', async () => {
    const m = await createMediaAsset(pdfInput(4));
    await updateDocumentSlotAction({ slotId: 'tata-tertib', mediaId: m.id });
    await updateDocumentSlotAction({ slotId: 'tata-tertib', mediaId: null });
    expect(await prisma.mediaUsage.findMany({ where: { mediaId: m.id } })).toHaveLength(0);
    const row = await prisma.documentSlot.findUnique({ where: { id: 'tata-tertib' } });
    expect(row?.mediaId).toBeNull();
  });

  it('rejects an unknown slotId with a Zod error', async () => {
    const r = await updateDocumentSlotAction({ slotId: 'rahasia-sekolah', mediaId: null });
    expect(r.ok).toBe(false);
    // withRole maps ZodError to its first issue message — not 'forbidden' / 'unauthorized'.
    if (!r.ok) expect(r.error.length).toBeGreaterThan(0);
  });

  it('forbids when no session', async () => {
    mockSession.mockResolvedValue(null);
    const r = await updateDocumentSlotAction({ slotId: 'kalender-akademik', mediaId: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('unauthorized');
  });
});
