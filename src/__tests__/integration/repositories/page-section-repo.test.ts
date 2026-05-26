import { prisma } from '@/lib/db/client';
import { getPageSections } from '@/lib/data/repositories/page-section-repo';

describe('pageSectionRepo.getPageSections', () => {
  beforeAll(async () => {
    await prisma.pageSection.deleteMany({ where: { pageKey: 'test-page' } });
    await prisma.pageSection.create({
      data: { pageKey: 'test-page', sectionKey: 'hero', data: { title: 'Halo' } },
    });
    await prisma.pageSection.create({
      data: { pageKey: 'test-page', sectionKey: 'cta', data: { label: 'Klik' } },
    });
  });

  afterAll(async () => {
    await prisma.pageSection.deleteMany({ where: { pageKey: 'test-page' } });
    await prisma.$disconnect();
  });

  it('returns all sections for a pageKey keyed by sectionKey', async () => {
    const sections = await getPageSections('test-page');
    expect(sections).toEqual({
      hero: { title: 'Halo' },
      cta: { label: 'Klik' },
    });
  });

  it('returns empty object when pageKey has no rows', async () => {
    const sections = await getPageSections('nonexistent-page');
    expect(sections).toEqual({});
  });
});
