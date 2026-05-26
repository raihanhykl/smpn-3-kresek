import { execSync } from 'node:child_process';
import { prisma } from '@/lib/db/client';
import { assembleHome } from '@/lib/data/assemblers/home';
import { assembleProfile } from '@/lib/data/assemblers/profil';
import { assembleAcademic } from '@/lib/data/assemblers/akademik';
import { assembleFacilities } from '@/lib/data/assemblers/fasilitas';
import { assembleContact } from '@/lib/data/assemblers/kontak';

describe('page assemblers (post-seed)', () => {
  beforeAll(async () => {
    // Seed the DB so assemblers have data to work with.
    execSync('npx tsx scripts/seed-content.ts', {
      stdio: 'pipe', shell: '/bin/bash',
      env: { ...process.env, DATABASE_URL: 'postgresql://test:test@localhost:5433/smpn3_test?schema=public' },
    });
  }, 60_000);

  afterAll(async () => { await prisma.$disconnect(); });

  it('assembleHome scopes achievements + gallery via featuredIds', async () => {
    const home = await assembleHome();
    expect(home.hero.titleLine1).toMatch(/Selamat Datang/);
    expect(home.stats.cards.length).toBeGreaterThan(0);
    expect(home.sambutan.signatureName).toBeTruthy();
    expect(home.programs.cards.length).toBeGreaterThan(0);
    // Verify scoping: home should show ONLY its featured items (5 achievements
    // + 8 gallery), NOT the combined dedup'd pool (would be 11 and 18).
    // This is the visual-parity bug the per-page featuredIds fix prevents.
    const { homePageConfig } = await import('@config/pages/home');
    expect(home.achievements.items).toHaveLength(homePageConfig.achievements.items.length);
    expect(home.gallery.items).toHaveLength(homePageConfig.gallery.items.length);
    expect(home.lokasi.cards.length).toBeGreaterThan(0);
    expect(home.ctaFinal.title).toBeTruthy();
  });

  it('assembleProfile scopes prestasi via featuredIds', async () => {
    const profile = await assembleProfile();
    expect(profile.sejarah.timeline.length).toBeGreaterThan(0);
    expect(profile.visiMisi.misi.items.length).toBeGreaterThan(0);
    expect(profile.guru.teachers.length).toBeGreaterThan(0);
    const { profilPageConfig } = await import('@config/pages/profil');
    // /profil's prestasi section displays only the profil-featured set (6),
    // not the combined achievements pool.
    expect(profile.prestasi.items).toHaveLength(profilPageConfig.prestasi.items.length);
    expect(profile.struktur.chart.levels.length).toBeGreaterThan(0);
  });

  it('assembleProfile teachers ordered by category (pimpinan first)', async () => {
    const profile = await assembleProfile();
    expect(profile.guru.teachers[0]?.category).toBe('pimpinan');
  });

  it('assembleAcademic returns AcademicPageConfig shape', async () => {
    const academic = await assembleAcademic();
    expect(academic.mapel.tabs).toHaveLength(3);
    expect(academic.mapel.tabs[0]?.id).toBe('kelas7');
    expect(academic.mapel.tabs[0]?.groups.length).toBeGreaterThan(0);
    expect(academic.kalender.events.length).toBeGreaterThan(0);
  });

  it('assembleFacilities scopes galeri via featuredIds; ekskul ordered by category sequence', async () => {
    const facilities = await assembleFacilities();
    expect(facilities.sarana.featured.length).toBeGreaterThan(0);
    expect(facilities.sarana.mini.length).toBeGreaterThan(0);
    const { fasilitasPageConfig } = await import('@config/pages/fasilitas');
    // Ekskul: full list, but ordered by categoryOrder (wajib first), not alphabetical.
    expect(facilities.ekskul.items[0]?.category).toBe('wajib');
    // Galeri: scoped to fasilitas-only featured set, not combined with home.
    expect(facilities.galeri.items).toHaveLength(fasilitasPageConfig.galeri.items.length);
  });

  it('assembleContact returns ContactPageConfig shape', async () => {
    const contact = await assembleContact();
    expect(contact.faq.items.length).toBeGreaterThan(0);
    expect(contact.form.waNumber).toBeTruthy();
  });
});
