import { prisma } from '@/lib/db/client';
import { setPageSectionPhoto, getPageSectionPhoto } from '@/lib/data/repositories/page-section-repo';

describe('setPageSectionPhoto', () => {
  beforeEach(async () => {
    await prisma.pageSection.deleteMany({ where: { pageKey: 'home', sectionKey: 'hero' } });
    await prisma.pageSection.create({
      data: { pageKey: 'home', sectionKey: 'hero', data: { badge: 'X', titleLine1: 'A' } },
    });
  });
  afterAll(async () => {
    await prisma.pageSection.deleteMany({ where: { pageKey: 'home', sectionKey: 'hero' } });
    await prisma.$disconnect();
  });

  it('merges the photo into existing section JSON without clobbering other keys', async () => {
    const photo = {
      kind: 'url' as const, src: 'smpn3kresek/image/abc', alt: 'x',
      cropX: 0.1, cropY: 0.1, cropW: 0.5, cropH: 0.5,
    };
    const merged = await setPageSectionPhoto('home', 'hero', 'photo', photo);
    expect(merged.badge).toBe('X');
    expect(merged.titleLine1).toBe('A');
    expect(merged.photo).toEqual(photo);
    const row = await prisma.pageSection.findUnique({
      where: { pageKey_sectionKey: { pageKey: 'home', sectionKey: 'hero' } },
    });
    const stored = row?.data as { photo?: { src?: string } } | undefined;
    expect(stored?.photo?.src).toBe('smpn3kresek/image/abc');
  });

  it('overwrites a prior photo on the same field', async () => {
    await setPageSectionPhoto('home', 'hero', 'photo', { kind: 'url', src: 'a', alt: 'x' });
    const merged = await setPageSectionPhoto('home', 'hero', 'photo', { kind: 'url', src: 'b', alt: 'y' });
    expect((merged.photo as { src: string }).src).toBe('b');
  });

  it('getPageSectionPhoto returns the stored photo or null', async () => {
    expect(await getPageSectionPhoto('home', 'hero', 'photo')).toBeNull();
    await setPageSectionPhoto('home', 'hero', 'photo', { kind: 'url', src: 'a', alt: 'x' });
    const p = await getPageSectionPhoto('home', 'hero', 'photo');
    expect(p?.kind).toBe('url');
    if (p?.kind === 'url') expect(p.src).toBe('a');
  });

  it('throws when the section row does not exist', async () => {
    await expect(setPageSectionPhoto('home', 'doesnotexist', 'photo', { kind: 'url', src: 'a', alt: 'x' }))
      .rejects.toThrow();
  });
});
