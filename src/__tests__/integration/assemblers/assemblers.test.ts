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
      env: process.env,
    });
  }, 60_000);

  afterAll(async () => { await prisma.$disconnect(); });

  it('assembleHome caps achievements + gallery to the top-N by order', async () => {
    const home = await assembleHome();
    expect(home.hero.titleLine1).toMatch(/Selamat Datang/);
    expect(home.stats.cards.length).toBeGreaterThan(0);
    expect(home.sambutan.signatureName).toBeTruthy();
    expect(home.programs.cards.length).toBeGreaterThan(0);
    // Home shows the top-N of each list (5 achievements, 8 gallery) by order,
    // so newly added items surface automatically without manual curation.
    expect(home.achievements.items).toHaveLength(5);
    expect(home.gallery.items).toHaveLength(8);
    expect(home.lokasi.cards.length).toBeGreaterThan(0);
    expect(home.ctaFinal.title).toBeTruthy();
  });

  it('assembleProfile returns the full ordered prestasi list', async () => {
    const profile = await assembleProfile();
    expect(profile.sejarah.timeline.length).toBeGreaterThan(0);
    expect(profile.visiMisi.misi.items.length).toBeGreaterThan(0);
    expect(profile.guru.teachers.length).toBeGreaterThan(0);
    // /profil shows every achievement in the DB, ordered by the admin reorder
    // column — so an admin add/edit is always reflected.
    const total = await prisma.achievement.count();
    expect(profile.prestasi.items).toHaveLength(total);
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

  it('assembleFacilities returns full ordered galeri; ekskul ordered by category sequence', async () => {
    const facilities = await assembleFacilities();
    expect(facilities.sarana.featured.length).toBeGreaterThan(0);
    expect(facilities.sarana.mini.length).toBeGreaterThan(0);
    // Ekskul: full list, but ordered by categoryOrder (wajib first), not alphabetical.
    expect(facilities.ekskul.items[0]?.category).toBe('wajib');
    // Galeri: every gallery item in the DB, ordered by the admin reorder column.
    const total = await prisma.galleryItem.count();
    expect(facilities.galeri.items).toHaveLength(total);
  });

  it('assembleContact returns ContactPageConfig shape', async () => {
    const contact = await assembleContact();
    expect(contact.faq.items.length).toBeGreaterThan(0);
    expect(contact.form.waNumber).toBeTruthy();
  });
});
