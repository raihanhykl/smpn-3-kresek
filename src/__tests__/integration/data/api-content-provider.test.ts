import { execSync } from 'node:child_process';
import { prisma } from '@/lib/db/client';
import { ApiContentProvider } from '@/lib/data/ApiContentProvider';

describe('ApiContentProvider (full)', () => {
  beforeAll(() => {
    execSync('npx tsx scripts/seed-content.ts', {
      stdio: 'pipe', shell: '/bin/bash',
      env: { ...process.env, DATABASE_URL: 'postgresql://test:test@localhost:5433/smpn3_test?schema=public' },
    });
  }, 60_000);

  afterAll(async () => { await prisma.$disconnect(); });

  const provider = new ApiContentProvider();

  it('getSiteConfig returns SiteConfig with kontakCta', async () => {
    const site = await provider.getSiteConfig();
    expect(site.brand.name).toBeTruthy();
    expect(site.kontakCta.label).toBe('Kontak');
  });

  it('getHomePage returns HomePageConfig', async () => {
    const home = await provider.getHomePage();
    expect(home.hero).toBeTruthy();
    expect(home.gallery.items.length).toBeGreaterThan(0);
  });

  it('getProfilePage returns ProfilePageConfig', async () => {
    const profile = await provider.getProfilePage();
    expect(profile.guru.teachers.length).toBeGreaterThan(0);
  });

  it('getAcademicPage returns AcademicPageConfig', async () => {
    const academic = await provider.getAcademicPage();
    expect(academic.mapel.tabs).toHaveLength(3);
  });

  it('getFacilitiesPage returns FacilitiesPageConfig', async () => {
    const facilities = await provider.getFacilitiesPage();
    expect(facilities.ekskul.items.length).toBeGreaterThan(0);
  });

  it('getContactPage returns ContactPageConfig', async () => {
    const contact = await provider.getContactPage();
    expect(contact.faq.items.length).toBeGreaterThan(0);
  });
});
