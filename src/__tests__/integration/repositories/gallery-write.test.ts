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

  // Phase 4 — crop region round-trips through _photo-columns automatically.
  it('persists and reads back a url photo crop region', async () => {
    const g = await createGalleryItem(input({
      photo: {
        kind: 'url', src: 'smpn3kresek/image/abc', alt: 'foto',
        cropX: 0.1, cropY: 0.2, cropW: 0.5, cropH: 0.4,
      },
    }));
    const row = await prisma.galleryItem.findUnique({ where: { id: g.id } });
    expect(row?.photoCropX).toBe(0.1);
    expect(row?.photoCropY).toBe(0.2);
    expect(row?.photoCropW).toBe(0.5);
    expect(row?.photoCropH).toBe(0.4);
    expect(g.photo).toEqual({
      kind: 'url', src: 'smpn3kresek/image/abc', alt: 'foto',
      cropX: 0.1, cropY: 0.2, cropW: 0.5, cropH: 0.4,
    });
  });

  it('gradient photo stores null crop columns', async () => {
    const g = await createGalleryItem(input()); // gradient default
    const row = await prisma.galleryItem.findUnique({ where: { id: g.id } });
    expect(row?.photoCropX).toBeNull();
    expect(row?.photoCropY).toBeNull();
    expect(row?.photoCropW).toBeNull();
    expect(row?.photoCropH).toBeNull();
  });

  it('url photo without a crop stores null crop columns', async () => {
    const g = await createGalleryItem(input({
      photo: { kind: 'url', src: 'smpn3kresek/image/xyz', alt: 'foto' },
    }));
    const row = await prisma.galleryItem.findUnique({ where: { id: g.id } });
    expect(row?.photoCropX).toBeNull();
    expect(g.photo).toEqual({ kind: 'url', src: 'smpn3kresek/image/xyz', alt: 'foto' });
  });
});
