/* eslint-disable no-console */
import { prisma } from '../src/lib/db/client';
import { siteConfig as rawSite } from '../src/config/site';
import { navigation as rawNav } from '../src/config/navigation';
import { homePageConfig } from '../src/config/pages/home';
import { profilPageConfig } from '../src/config/pages/profil';
import { akademikPageConfig } from '../src/config/pages/akademik';
import { fasilitasPageConfig } from '../src/config/pages/fasilitas';
import { kontakPageConfig } from '../src/config/pages/kontak';
import { siteConfigSchema } from '../src/lib/validation/schemas/site-config';
import { navigationSchema } from '../src/lib/validation/schemas/navigation';
import { TEACHER_CATEGORY_ORDER, EKSKUL_CATEGORY_ORDER } from '../src/config/category-order';

// Helper: dump every section of a page into PageSection rows.
async function seedPageSections(pageKey: string, sections: Record<string, unknown>) {
  for (const [sectionKey, data] of Object.entries(sections)) {
    await prisma.pageSection.upsert({
      where: { pageKey_sectionKey: { pageKey, sectionKey } },
      create: { pageKey, sectionKey, data: data as object },
      update: { data: data as object },
    });
  }
}

async function main() {
  console.log('==> Seed: SiteConfig + Navigation');
  const { navigation: _navFromSite, ...siteRest } = rawSite;
  void _navFromSite;
  const siteData = siteRest;
  siteConfigSchema.parse({ ...siteData, navigation: rawNav });
  navigationSchema.parse(rawNav);

  await prisma.siteConfig.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', data: siteData as object },
    update: { data: siteData as object },
  });
  await prisma.navigation.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', items: rawNav as unknown as object },
    update: { items: rawNav as unknown as object },
  });

  // ── Page sections ──
  console.log('==> Seed: PageSection rows (home)');
  await seedPageSections('home', {
    hero: homePageConfig.hero,
    stats: homePageConfig.stats,
    sambutan: homePageConfig.sambutan,
    about: homePageConfig.about,
    programs: homePageConfig.programs,
    // featuredIds list scopes which gallery items + achievements appear on /home,
    // preventing the "show all 11" bug when other pages add entries to the same tables.
    galleryMeta: {
      meta: homePageConfig.gallery.meta,
      ctaLabel: homePageConfig.gallery.ctaLabel,
      ctaHref: homePageConfig.gallery.ctaHref,
      featuredIds: homePageConfig.gallery.items.map((g) => g.id),
    },
    achievementsMeta: {
      meta: homePageConfig.achievements.meta,
      ctaLabel: homePageConfig.achievements.ctaLabel,
      ctaHref: homePageConfig.achievements.ctaHref,
      featuredIds: homePageConfig.achievements.items.map((a) => a.id),
    },
    lokasi: homePageConfig.lokasi,
    ctaFinal: homePageConfig.ctaFinal,
  });

  console.log('==> Seed: PageSection rows (profil)');
  await seedPageSections('profil', {
    pageHeader: profilPageConfig.pageHeader,
    sejarah: profilPageConfig.sejarah,
    visiMisi: profilPageConfig.visiMisi,
    tujuan: profilPageConfig.tujuan,
    identitas: profilPageConfig.identitas,
    strukturMeta: { meta: profilPageConfig.struktur.meta, studentNote: profilPageConfig.struktur.chart.studentNote },
    guruMeta: { meta: profilPageConfig.guru.meta, filterLabels: profilPageConfig.guru.filterLabels },
    prestasiMeta: {
      meta: profilPageConfig.prestasi.meta,
      featuredIds: profilPageConfig.prestasi.items.map((a) => a.id),
    },
    ctaFinal: profilPageConfig.ctaFinal,
  });

  console.log('==> Seed: PageSection rows (akademik)');
  await seedPageSections('akademik', {
    pageHeader: akademikPageConfig.pageHeader,
    kurikulum: akademikPageConfig.kurikulum,
    mapelMeta: { meta: akademikPageConfig.mapel.meta },
    jadwal: akademikPageConfig.jadwal,
    metode: akademikPageConfig.metode,
    penilaian: akademikPageConfig.penilaian,
    kalenderMeta: { meta: akademikPageConfig.kalender.meta, events: akademikPageConfig.kalender.events },
    ctaFinal: akademikPageConfig.ctaFinal,
  });

  console.log('==> Seed: PageSection rows (fasilitas)');
  await seedPageSections('fasilitas', {
    pageHeader: fasilitasPageConfig.pageHeader,
    saranaMeta: { meta: fasilitasPageConfig.sarana.meta, statStrip: fasilitasPageConfig.sarana.statStrip },
    ekskulMeta: { meta: fasilitasPageConfig.ekskul.meta, statStrip: fasilitasPageConfig.ekskul.statStrip, filterLabels: fasilitasPageConfig.ekskul.filterLabels },
    kegiatan: fasilitasPageConfig.kegiatan,
    galeriMeta: {
      meta: fasilitasPageConfig.galeri.meta,
      filterLabels: fasilitasPageConfig.galeri.filterLabels,
      featuredIds: fasilitasPageConfig.galeri.items.map((g) => g.id),
    },
    // Strip runtime-only documentSlot from the static seed — assemblers re-source it.
    tatib: { meta: fasilitasPageConfig.tatib.meta, accordions: fasilitasPageConfig.tatib.accordions },
    ctaFinal: fasilitasPageConfig.ctaFinal,
  });

  console.log('==> Seed: PageSection rows (kontak)');
  await seedPageSections('kontak', {
    pageHeader: kontakPageConfig.pageHeader,
    kontakInfo: kontakPageConfig.kontakInfo,
    peta: kontakPageConfig.peta,
    form: kontakPageConfig.form,
    faqMeta: { meta: kontakPageConfig.faq.meta, searchPlaceholder: kontakPageConfig.faq.searchPlaceholder, filterLabels: kontakPageConfig.faq.filterLabels, noResultsText: kontakPageConfig.faq.noResultsText, ctaText: kontakPageConfig.faq.ctaText, ctaHref: kontakPageConfig.faq.ctaHref },
    ctaFinal: kontakPageConfig.ctaFinal,
  });

  // ── Entities ──
  // Group teachers by category then assign intra-category order. categoryOrder
  // comes from TEACHER_CATEGORY_ORDER so display follows static (pimpinan first),
  // not alphabetical.
  console.log('==> Seed: Teachers');
  const teachersByCategory = new Map<string, typeof profilPageConfig.guru.teachers>();
  for (const t of profilPageConfig.guru.teachers) {
    const list = teachersByCategory.get(t.category) ?? [];
    list.push(t);
    teachersByCategory.set(t.category, list);
  }
  for (const [cat, list] of teachersByCategory) {
    const catOrder = TEACHER_CATEGORY_ORDER[cat as keyof typeof TEACHER_CATEGORY_ORDER] ?? 99;
    for (let i = 0; i < list.length; i++) {
      const t = list[i]!;
      const photo = t.photo;
      const order = i;
      // Field set differs by photoKind. Compute the full set once so create+update agree.
      const photoFields =
        photo.kind === 'url'
          ? {
              photoKind: 'url' as const,
              photoSrc: photo.src, photoAlt: photo.alt,
              photoFrom: null, photoTo: null, photoEmoji: null,
            }
          : {
              photoKind: 'gradient' as const,
              photoSrc: null, photoAlt: null,
              photoFrom: photo.from, photoTo: photo.to, photoEmoji: photo.emoji,
            };
      await prisma.teacher.upsert({
        where: { id: t.id },
        create: {
          id: t.id, name: t.name, position: t.position, badge: t.badge, category: t.category,
          categoryOrder: catOrder, order, ...photoFields,
        },
        update: {
          name: t.name, position: t.position, badge: t.badge, category: t.category,
          categoryOrder: catOrder, order, ...photoFields,
        },
      });
    }
  }

  console.log('==> Seed: Achievements (combined home + profil, dedup by id)');
  // Both home and profil reference achievements by id; merge so single row per
  // achievement exists. /home picks 5 via featuredIds, /profil picks 6.
  const allAchievements = new Map<string, (typeof homePageConfig.achievements.items)[number]>();
  for (const a of homePageConfig.achievements.items) allAchievements.set(a.id, a);
  for (const a of profilPageConfig.prestasi.items) allAchievements.set(a.id, a);
  const achievementEntries = Array.from(allAchievements.values());
  for (let idx = 0; idx < achievementEntries.length; idx++) {
    const a = achievementEntries[idx]!;
    const order = idx; // SAME order value passed to both create and update — avoids post-increment trap.
    await prisma.achievement.upsert({
      where: { id: a.id },
      create: {
        id: a.id, year: a.year, title: a.title, recipient: a.recipient,
        organizer: a.organizer, level: a.level, icon: a.icon, order,
      },
      update: {
        year: a.year, title: a.title, recipient: a.recipient,
        organizer: a.organizer, level: a.level, icon: a.icon, order,
      },
    });
  }

  console.log('==> Seed: Extracurriculars');
  const ekskulByCategory = new Map<string, typeof fasilitasPageConfig.ekskul.items>();
  for (const e of fasilitasPageConfig.ekskul.items) {
    const list = ekskulByCategory.get(e.category) ?? [];
    list.push(e);
    ekskulByCategory.set(e.category, list);
  }
  for (const [cat, list] of ekskulByCategory) {
    const catOrder = EKSKUL_CATEGORY_ORDER[cat as keyof typeof EKSKUL_CATEGORY_ORDER] ?? 99;
    for (let i = 0; i < list.length; i++) {
      const e = list[i]!;
      const order = i;
      const achievement = e.achievement ?? null;
      await prisma.extracurricular.upsert({
        where: { id: e.id },
        create: {
          id: e.id, name: e.name, category: e.category, categoryOrder: catOrder,
          description: e.description, pembina: e.pembina, schedule: e.schedule,
          achievement, icon: e.icon, order,
        },
        update: {
          name: e.name, category: e.category, categoryOrder: catOrder,
          description: e.description, pembina: e.pembina, schedule: e.schedule,
          achievement, icon: e.icon, order,
        },
      });
    }
  }

  console.log('==> Seed: Subjects (dedup across grades into hoursByGrade)');
  // The static config lists subjects per-grade; merge them so each subject is a
  // single row whose hoursByGrade records which grades teach it (+ JP each).
  // Identity = subject name. Group A (wajib) vs B (pengembangan) derived from the
  // group id suffix (k{7,8,9}-a → wajib, -b → pengembangan).
  type SeedSubject = {
    group: 'wajib' | 'pengembangan';
    name: string; icon: string; iconBg: string;
    hoursByGrade: Record<string, string>;
    order: number;
  };
  const merged = new Map<string, SeedSubject>();
  let nextOrder = 0;
  for (const tab of akademikPageConfig.mapel.tabs) {
    const grade = tab.id === 'kelas7' ? '7' : tab.id === 'kelas8' ? '8' : '9';
    for (const group of tab.groups) {
      const groupKey = group.id.endsWith('-a') ? 'wajib' : 'pengembangan';
      for (const s of group.subjects) {
        const key = s.name;
        let entry = merged.get(key);
        if (!entry) {
          entry = { group: groupKey, name: s.name, icon: s.icon, iconBg: s.iconBg, hoursByGrade: {}, order: nextOrder++ };
          merged.set(key, entry);
        }
        entry.hoursByGrade[grade] = s.hours;
      }
    }
  }
  await prisma.subject.deleteMany({});
  for (const s of merged.values()) {
    await prisma.subject.create({
      data: {
        group: s.group, name: s.name, icon: s.icon, iconBg: s.iconBg,
        hoursByGrade: s.hoursByGrade, order: s.order,
      },
    });
  }

  console.log('==> Seed: Faqs');
  for (let i = 0; i < kontakPageConfig.faq.items.length; i++) {
    const f = kontakPageConfig.faq.items[i]!;
    const order = i;
    await prisma.faq.upsert({
      where: { id: f.id },
      create: { id: f.id, question: f.question, answer: f.answer, category: f.category, order },
      update: { question: f.question, answer: f.answer, category: f.category, order },
    });
  }

  console.log('==> Seed: GalleryItems (combined home + fasilitas, dedup by id)');
  const allGallery = new Map<string, (typeof homePageConfig.gallery.items)[number]>();
  for (const g of homePageConfig.gallery.items) allGallery.set(g.id, g);
  for (const g of fasilitasPageConfig.galeri.items) allGallery.set(g.id, g);
  const galleryEntries = Array.from(allGallery.values());
  for (let idx = 0; idx < galleryEntries.length; idx++) {
    const g = galleryEntries[idx]!;
    const order = idx;
    // Phase 3b: seed maps the static-config Photo (always gradient kind)
    // onto the new 6-column Photo storage.
    const photoCols = g.photo.kind === 'url'
      ? {
          photoKind: 'url',
          photoSrc: g.photo.src,
          photoAlt: g.photo.alt,
          photoFrom: null,
          photoTo: null,
          photoEmoji: null,
        }
      : {
          photoKind: 'gradient',
          photoSrc: null,
          photoAlt: null,
          photoFrom: g.photo.from,
          photoTo: g.photo.to,
          photoEmoji: g.photo.emoji,
        };
    await prisma.galleryItem.upsert({
      where: { id: g.id },
      create: {
        id: g.id, caption: g.caption,
        ...photoCols,
        category: g.category ?? null, span: g.span ?? null, order,
      },
      update: {
        caption: g.caption,
        ...photoCols,
        category: g.category ?? null, span: g.span ?? null, order,
      },
    });
  }

  console.log('==> Seed: Facilities');
  for (let i = 0; i < fasilitasPageConfig.sarana.featured.length; i++) {
    const f = fasilitasPageConfig.sarana.featured[i]!;
    const order = i;
    const photoCols = f.photo.kind === 'url'
      ? {
          photoKind: 'url',
          photoSrc: f.photo.src,
          photoAlt: f.photo.alt,
          photoFrom: null,
          photoTo: null,
          photoEmoji: null,
        }
      : {
          photoKind: 'gradient',
          photoSrc: null,
          photoAlt: null,
          photoFrom: f.photo.from,
          photoTo: f.photo.to,
          photoEmoji: f.photo.emoji,
        };
    await prisma.facility.upsert({
      where: { id: f.id },
      create: {
        id: f.id, kind: 'featured', name: f.name, description: f.description,
        ...photoCols, span: f.span ?? null, icon: null, order,
      },
      update: {
        kind: 'featured', name: f.name, description: f.description,
        ...photoCols, span: f.span ?? null, icon: null, order,
      },
    });
  }
  for (let i = 0; i < fasilitasPageConfig.sarana.mini.length; i++) {
    const m = fasilitasPageConfig.sarana.mini[i]!;
    const order = i;
    await prisma.facility.upsert({
      where: { id: m.id },
      create: {
        id: m.id, kind: 'mini', name: m.name, icon: m.icon,
        description: null,
        photoKind: null, photoSrc: null, photoAlt: null,
        photoFrom: null, photoTo: null, photoEmoji: null,
        span: null,
        order,
      },
      update: {
        kind: 'mini', name: m.name, icon: m.icon,
        description: null,
        photoKind: null, photoSrc: null, photoAlt: null,
        photoFrom: null, photoTo: null, photoEmoji: null,
        span: null,
        order,
      },
    });
  }

  console.log('==> Seed: OrganizationChart (wipe + recreate for stable structure)');
  // OrganizationMember structure changes irregularly between deployments. Index-based IDs
  // (lvl0-0, lvl0-1, ...) become orphans if static config rearranges. Wiping + recreating
  // is simple, fast (few rows), and idempotent. Phase 2 admin UI will eventually replace
  // this with stable cuid()-generated IDs managed via CRUD UI.
  await prisma.organizationMember.deleteMany({});
  let omOrder = 0;
  for (let levelIdx = 0; levelIdx < profilPageConfig.struktur.chart.levels.length; levelIdx++) {
    const lvl = profilPageConfig.struktur.chart.levels[levelIdx]!;
    for (let bIdx = 0; bIdx < lvl.boxes.length; bIdx++) {
      const box = lvl.boxes[bIdx]!;
      const id = `${lvl.id}-${bIdx}`;
      const order = omOrder++;
      await prisma.organizationMember.create({
        data: { id, name: box.name, role: box.title, level: levelIdx, order },
      });
    }
  }

  console.log('==> Seed: DocumentSlots (empty placeholders)');
  for (const slotId of ['kalender-akademik', 'tata-tertib']) {
    await prisma.documentSlot.upsert({
      where: { id: slotId },
      create: { id: slotId, mediaId: null },
      update: {},
    });
  }

  console.log('==> Done');
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
