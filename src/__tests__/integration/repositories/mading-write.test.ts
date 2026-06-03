import {
  createMading, getAllMading, getMadingById, updateMading, deleteMading,
} from '@/lib/data/repositories/mading-repo';
import { prisma } from '@/lib/db/client';

describe('mading-repo', () => {
  const ids: string[] = [];
  afterAll(async () => {
    await prisma.mading.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });

  it('creates, reads, round-trips images JSON, updates, deletes', async () => {
    const created = await createMading({
      title: 'Berita A',
      body: 'Paragraf satu.\n\nParagraf dua.',
      images: [{ src: 'smpn3/a1', alt: 'Foto A1' }, { src: 'smpn3/a2', alt: 'Foto A2' }],
    });
    ids.push(created.id);
    expect(created.images).toHaveLength(2);
    expect(created.images[0]).toEqual({ src: 'smpn3/a1', alt: 'Foto A1' });
    expect(typeof created.createdAt).toBe('string');

    const byId = await getMadingById(created.id);
    expect(byId?.title).toBe('Berita A');
    expect(byId?.images).toHaveLength(2);

    const updated = await updateMading(created.id, {
      title: 'Berita A (edit)',
      images: [{ src: 'smpn3/a1', alt: 'Foto A1' }],
    });
    expect(updated.images).toHaveLength(1);
    expect(updated.body).toBeUndefined();

    await deleteMading(created.id);
    expect(await getMadingById(created.id)).toBeNull();
  });

  it('getAllMading returns newest first', async () => {
    const a = await createMading({ title: 'Lama', images: [{ src: 'smpn3/x', alt: 'x' }] });
    const b = await createMading({ title: 'Baru', images: [{ src: 'smpn3/y', alt: 'y' }] });
    ids.push(a.id, b.id);
    const all = await getAllMading();
    const idxA = all.findIndex((m) => m.id === a.id);
    const idxB = all.findIndex((m) => m.id === b.id);
    expect(idxB).toBeLessThan(idxA);
  });
});
