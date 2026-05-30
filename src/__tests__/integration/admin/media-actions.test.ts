import { prisma } from '@/lib/db/client';
import { createMediaAsset } from '@/lib/data/repositories/media-repo';
import { linkMediaUsage } from '@/lib/media/link-usage';

jest.mock('@/lib/auth/session', () => ({ getSession: jest.fn() }));
import { getSession } from '@/lib/auth/session';
const mockSession = getSession as jest.Mock;

import { deleteMediaAction, forceDeleteMediaAction } from '@/app/(admin)/admin/media/_actions/media-actions';

function makeInput(i = 0): Parameters<typeof createMediaAsset>[0] {
  const hex = i.toString(16).padStart(64, '0');
  return {
    kind: 'image', url: 'https://res.cloudinary.com/test-cloud/image/upload/v1/x.jpg',
    publicId: `smpn3kresek/image/x${i}`, hash: hex,
    alt: null, filename: 'x.jpg', sizeBytes: 1024, mimeType: 'image/jpeg',
    width: null, height: null, uploadedBy: 'seed',
  };
}

describe('media-actions', () => {
  beforeEach(async () => {
    mockSession.mockResolvedValue({ user: { id: 'admin-act', role: 'ADMIN' } });
    await prisma.mediaAsset.deleteMany({});
  });
  afterAll(async () => {
    await prisma.mediaAsset.deleteMany({});
    await prisma.$disconnect();
  });

  describe('deleteMediaAction', () => {
    it('returns forbidden when no session', async () => {
      mockSession.mockResolvedValue(null);
      const m = await createMediaAsset(makeInput(1));
      const r = await deleteMediaAction(m.id);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBe('unauthorized');
    });

    it('deletes an unused asset and returns { deleted: true }', async () => {
      const m = await createMediaAsset(makeInput(2));
      const r = await deleteMediaAction(m.id);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.data).toEqual({ deleted: true });
      expect(await prisma.mediaAsset.findUnique({ where: { id: m.id } })).toBeNull();
    });

    it('refuses to delete a used asset and returns the usage list', async () => {
      const m = await createMediaAsset(makeInput(3));
      await linkMediaUsage({ mediaId: m.id, usedInTable: 'Teacher', usedInId: 't1', usedInField: 'photoSrc' });
      const r = await deleteMediaAction(m.id);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.data.deleted).toBe(false);
        if (!r.data.deleted) {
          expect(r.data.usage).toHaveLength(1);
          expect(r.data.usage[0]?.usedInTable).toBe('Teacher');
        }
      }
      expect(await prisma.mediaAsset.findUnique({ where: { id: m.id } })).not.toBeNull();
    });

    it('returns not_found when the asset does not exist', async () => {
      const r = await deleteMediaAction('nonexistent-id');
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBe('not_found');
    });
  });

  describe('forceDeleteMediaAction', () => {
    it('forbids EDITOR even when usage is empty', async () => {
      mockSession.mockResolvedValue({ user: { id: 'editor-1', role: 'EDITOR' } });
      const m = await createMediaAsset(makeInput(4));
      const r = await forceDeleteMediaAction(m.id);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBe('forbidden');
      expect(await prisma.mediaAsset.findUnique({ where: { id: m.id } })).not.toBeNull();
    });

    it('deletes the asset AND removes its usage rows (ADMIN)', async () => {
      const m = await createMediaAsset(makeInput(5));
      await linkMediaUsage({ mediaId: m.id, usedInTable: 'Teacher', usedInId: 't9', usedInField: 'photoSrc' });
      await linkMediaUsage({ mediaId: m.id, usedInTable: 'DocumentSlot', usedInId: 'kalender-akademik', usedInField: 'mediaId' });
      const r = await forceDeleteMediaAction(m.id);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.data).toEqual({ deleted: true });
      expect(await prisma.mediaAsset.findUnique({ where: { id: m.id } })).toBeNull();
      expect(await prisma.mediaUsage.count({ where: { mediaId: m.id } })).toBe(0);
    });

    it('returns not_found when the asset does not exist', async () => {
      const r = await forceDeleteMediaAction('nope');
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBe('not_found');
    });
  });
});
