import { prisma } from '@/lib/db/client';
import {
  createGalleryItem, updateGalleryItem, deleteGalleryItem, reorderGalleryItems,
} from '@/lib/data/repositories/gallery-repo';

function input(overrides: Partial<Parameters<typeof createGalleryItem>[0]> = {}) {
  return {
    caption: 'Upacara',
    photo: { kind: 'gradient' as const, from: '#DBEAFE', to: '#93C5FD', emoji: '🏫' },
    ...overrides,
  };
}

describe('gallery write repository', () => {
  beforeEach(async () => { await prisma.galleryItem.deleteMany({}); });
  afterAll(async () => { await prisma.galleryItem.deleteMany({}); await prisma.$disconnect(); });

  it('create + update + delete roundtrip; optional category/span omitted when absent', async () => {
    const g = await createGalleryItem(input());
    expect(g.id).toBeTruthy();
    expect(g.category).toBeUndefined();
    expect(g.span).toBeUndefined();
    const u = await updateGalleryItem(g.id, input({ caption: 'Wisuda', category: 'akademik', span: 'wide' }));
    expect(u.caption).toBe('Wisuda');
    expect(u.category).toBe('akademik');
    expect(u.span).toBe('wide');
    await deleteGalleryItem(g.id);
    expect(await prisma.galleryItem.findUnique({ where: { id: g.id } })).toBeNull();
  });

  it('reorder sets order by global index', async () => {
    const a = await createGalleryItem(input({ caption: 'A' }));
    const b = await createGalleryItem(input({ caption: 'B' }));
    await reorderGalleryItems([b.id, a.id]);
    const rows = await prisma.galleryItem.findMany({ orderBy: { order: 'asc' } });
    expect(rows.map((r) => r.id)).toEqual([b.id, a.id]);
  });
});
