# Static Text → Config (drop PageSection / SiteConfig / Navigation) — Design Spec

**Date:** 2026-06-03
**Status:** Approved (decisions confirmed by user)

## Goal

Move all *static text* (page-section wording, site config, navigation) out of the
database and back into typed config files (`src/config/`), so editing a string in
code immediately changes the live site — no reseed, no DB edit. The site currently
runs in `api` mode and reads this text from DB tables, which is why editing config
appeared to do nothing.

Keep DB-backed only what genuinely benefits from runtime editing: entity CRUD
(teachers, achievements, mading, …), media assets, document slots, and the **6
admin-editable section photos** (which move from `PageSection` to a new dedicated
`SectionPhoto` table).

## Rationale (user's reasoning)

Section text is rarely changed and a full 285-field admin editor isn't worth the
build time. If the school wants a wording change, they ask the developer — a trivial
code edit + redeploy. Brand/social/nav are likewise near-static singletons.

## Decisions (confirmed)

| Topic | Decision |
|---|---|
| Section text | → config (`src/config/pages/*.ts`), read directly by assemblers. Not in DB. |
| SiteConfig (brand, social, kontakCta, accreditation) | → config (`src/config/site.ts`), read directly. Drop `SiteConfig` table. |
| Navigation (navbar menu) | → config (`src/config/navigation.ts`, already has `/mading`). Drop `Navigation` table. |
| Section photos (6 slots) | **Stay editable via dashboard.** Move storage from `PageSection.data` to a new `SectionPhoto` table. |
| Tables dropped | `PageSection`, `SiteConfig`, `Navigation` (3). |
| Tables kept | entity tables, `MediaAsset`, `MediaUsage`, `DocumentSlot`, + new `SectionPhoto`. |
| Seed | Stop seeding PageSection/SiteConfig/Navigation. SectionPhoto starts empty (admin sets photos via UI). |

## The photo-overlay model (the crux)

Config sections already carry an optional `photo?` field (currently unset → the UI
falls back to a gradient placeholder). The 6 editable photos are overlaid at
assemble time:

```ts
const hero = { ...homePageConfig.hero, photo: dbPhoto('home','hero','photo') ?? homePageConfig.hero.photo };
```

- **Text** → always from config.
- **Photo** → from `SectionPhoto` (DB) when the admin has set one, else the config's
  `photo` (unset → gradient placeholder). The existing render components already
  branch on `photo?.kind === 'url'`.
- `about` overlays two fields: `photoMain`, `photoSub`.

The 6 slots (unchanged from `PAGE_PHOTO_SLOTS`):
| pageKey | sectionKey | field |
|---|---|---|
| home | hero | photo |
| home | sambutan | photo |
| home | about | photoMain |
| home | about | photoSub |
| profil | sejarah | photo |
| akademik | kurikulum | photo |

## Architecture

### New model: `SectionPhoto` (replaces PageSection's photo role)

Flat photo columns (consistent with Teacher/Achievement/GalleryItem), keyed by the
slot triple:

```prisma
model SectionPhoto {
  pageKey    String   // 'home' | 'profil' | 'akademik'
  sectionKey String   // 'hero' | 'sambutan' | 'about' | 'sejarah' | 'kurikulum'
  field      String   // 'photo' | 'photoMain' | 'photoSub'
  photoKind  String?  // 'url' | 'gradient' | null (null = unset → config/UI default)
  photoSrc   String?  @db.VarChar(255)
  photoAlt   String?  @db.Text
  photoFrom  String?
  photoTo    String?
  photoEmoji String?
  photoCropX Float?
  photoCropY Float?
  photoCropW Float?
  photoCropH Float?
  updatedAt  DateTime @updatedAt
  updatedBy  String?

  @@id([pageKey, sectionKey, field])
}
```

> Stores the full Photo discriminated union (url: src+alt+crop; gradient:
> from+to+emoji) as flat columns — same convention as entity photos, reusing the
> existing `_photo-columns.ts` `photoFromRow`/`photoToColumns` helpers. NOT a bare
> mediaId (that would lose crop/alt/kind). No FK to MediaAsset needed — usage is
> tracked via `MediaUsage` (below), matching the entity-photo pattern.

### MediaUsage tracking

Section-photo usage moves from `usedInTable:'PageSection'` to
`usedInTable:'SectionPhoto'`, `usedInId:'${pageKey}:${sectionKey}:${field}'`,
`usedInField:'photo'`. `syncPhotoUsage(prev, next, ref)` is reused unchanged. Orphan
detection in the media library stays accurate.

### New repo: `section-photo-repo.ts` (replaces page-section-repo.ts)

```ts
getSectionPhoto(pageKey, sectionKey, field): Promise<Photo | null>   // null = unset
setSectionPhoto(pageKey, sectionKey, field, photo): Promise<void>    // upsert by composite id
getAllSectionPhotos(): Promise<Record<slotKey, Photo>>               // for assemblers + admin page (one query)
```

- Uses `photoToColumns`/`photoFromRow` from `_photo-columns.ts`.
- **NULL guard (required):** `photoFromRow` THROWS on `photoKind == null`. Rows are
  created lazily and an unset/reset slot has `photoKind = null`. So `getSectionPhoto`
  and `getAllSectionPhotos` MUST `return null` (skip that key) when the row is absent
  OR `row.photoKind == null` — never call `photoFromRow` on a null-kind row.
- `setSectionPhoto` is an **upsert** (the row may not exist yet — unlike the old
  read-modify-write which assumed a seeded PageSection row). This is the key
  behavioral change: no seeding, rows created on first save.
- Cached read (`unstable_cache`, tag `section-photos`) so assemblers don't re-query
  per request; `setSectionPhoto` → `revalidateTag('section-photos')` + `page:<key>`.

### Assemblers (5) read config + overlay photo

Each `assembleX()` drops `getPageSections()`. The assemblers MUST STAY: they merge
runtime **entity** data (which config does NOT hold as truth) into the page shape.
What each assembler adds beyond config text (PRESERVE THESE ENTITY READS VERBATIM):

| Assembler | Entity reads to preserve |
|---|---|
| home | `getAllAchievements()` top-5, `getAllGalleryItems()` top-8 |
| profil | `getTeachers()`, `getAllAchievements()`, `getOrganizationChart()` |
| akademik | `getSubjectGroupsByGrade(7/8/9)`, `getDocumentSlotWithMedia('kalender-akademik')` |
| fasilitas | `getExtracurriculars()`, `getAllGalleryItems()`, `getFacilitiesGrouped()`, `getDocumentSlotWithMedia('tata-tertib')` |
| kontak | `getFaqs()` |

> The config's `gallery.items` / `prestasi.items` / `guru.teachers` / `mapel.tabs` etc.
> are SEED-SOURCE data, NOT runtime truth — the live page shows DB entities (admin
> CRUD). Never freeze these to config. (Protects the "admin CRUD must show on public
> site" rule.)

**CRITICAL — config shape ≠ the old DB-section shape.** The seed *transformed* config
into split DB sections with different keys (`gallery`→`galleryMeta`, `struktur`→
`strukturMeta`, etc.). The assemblers read those *split* keys. Now that we read config
directly, use the config's NATIVE nested paths and reassemble the SAME return object.
Per-section mapping (config path → assembler return field):

**home** (`HomePageConfig`):
- `hero` ← `c.hero` (+ photo overlay `photo`)
- `stats` ← `c.stats`
- `sambutan` ← `c.sambutan` (+ photo overlay `photo`)
- `about` ← `c.about` (+ photo overlay `photoMain`, `photoSub`; leave `photoMainText`/`photoSubText` text untouched)
- `programs` ← `c.programs`
- `gallery` ← `{ meta: c.gallery.meta, items: <top-8 entities>, ctaLabel: c.gallery.ctaLabel, ctaHref: c.gallery.ctaHref }`
- `achievements` ← `{ meta: c.achievements.meta, items: <top-5 entities>, ctaLabel: c.achievements.ctaLabel, ctaHref: c.achievements.ctaHref }`
- `lokasi` ← `c.lokasi`; `ctaFinal` ← `c.ctaFinal`
- (`featuredIds` is NOT used — current assembler already does top-N slice, not featuredIds. Do not reintroduce it.)

**profil** (`ProfilePageConfig`):
- `pageHeader` ← `c.pageHeader`; `sejarah` ← `c.sejarah` (+ photo overlay `photo`); `visiMisi` ← `c.visiMisi`; `tujuan` ← `c.tujuan`; `identitas` ← `c.identitas`
- `struktur` ← `{ meta: c.struktur.meta, chart: <getOrganizationChart()>, studentNote: c.struktur.chart.studentNote }` (match the CURRENT assembler's exact field layout — re-read it)
- `guru` ← `{ meta: c.guru.meta, teachers: <getTeachers()>, filterLabels: c.guru.filterLabels }`
- `prestasi` ← `{ meta: c.prestasi.meta, items: <getAllAchievements()> }`
- `ctaFinal` ← `c.ctaFinal`

**akademik** (`AcademicPageConfig`):
- `pageHeader` ← `c.pageHeader`; `kurikulum` ← `c.kurikulum` (+ photo overlay `photo`); `jadwal` ← `c.jadwal`; `metode` ← `c.metode`; `penilaian` ← `c.penilaian`
- `mapel` ← `{ meta: c.mapel.meta, tabs/groups: <getSubjectGroupsByGrade>... }` (match current assembler shape exactly)
- `kalender` ← `{ meta: c.kalender.meta, events: c.kalender.events, documentSlot: <getDocumentSlotWithMedia('kalender-akademik')> }`
- `ctaFinal` ← `c.ctaFinal`

**fasilitas** (`FacilitiesPageConfig`) — NO photo overlay (no slots): `pageHeader`,
`sarana`←`{meta, statStrip, items?…}` merging `getFacilitiesGrouped()`; `ekskul`
merging `getExtracurriculars()`; `kegiatan`←`c.kegiatan`; `galeri` merging
`getAllGalleryItems()`; `tatib`←`{...c.tatib, documentSlot: getDocumentSlotWithMedia('tata-tertib')}`; `ctaFinal`.

**kontak** (`ContactPageConfig`) — NO photo overlay: `pageHeader`, `kontakInfo`,
`peta`, `form`, `faq`←`{...c.faq, items: getFaqs()}`, `ctaFinal`.

> **The authoritative source for each assembler's exact return shape is the CURRENT
> assembler file.** Implementation rule: open the current `assembleX()`, keep its
> return structure and entity reads identical, and replace each `sections.X as T`
> with the config-native value (+ photo overlay where applicable). Delete the now-dead
> local type aliases (`GalleryMetaSection`, `StrukturMetaSection`, …) and the
> `getPageSections` import. Only home/profil/akademik call `getAllSectionPhotos()`;
> fasilitas/kontak do not.

Photo overlay snippet (home, illustrative):
```ts
const photos = await getAllSectionPhotos();           // Record<'<page>:<section>:<field>', Photo>
hero: { ...c.hero, photo: photos['home:hero:photo'] ?? c.hero.photo },
about: { ...c.about,
  photoMain: photos['home:about:photoMain'] ?? c.about.photoMain,
  photoSub:  photos['home:about:photoSub']  ?? c.about.photoSub },
```

### SiteConfig & Navigation → config

- `getSiteConfig()` (site-repo.ts) currently reads `SiteConfig` + `Navigation` rows,
  merges, Zod-validates. Replace with a direct return of `siteConfig` from
  `src/config/site.ts` (which already embeds `navigation` from `config/navigation.ts`
  — verify the shape; `StaticContentProvider.getSiteConfig()` already returns it).
- Simplest: `ApiContentProvider.getSiteConfig()` returns the config object (same as
  StaticContentProvider). The `site-repo.ts` DB reader is deleted.
- Cache tags `site-config`/`navigation` become irrelevant (config is build-time).

## Public render: unchanged

Render components already branch on `photo?.kind`. With text from config and photo
overlaid, the rendered output is identical to today (assuming no admin photo set).
The Phase 5 photo editor keeps working against the new storage.

## Migration

A single Prisma migration: `DROP TABLE PageSection, SiteConfig, Navigation` +
`CREATE TABLE SectionPhoto`. No FK from these tables to others (verified), so drops
are safe. Generated via `prisma migrate dev --name static_text_to_config`.

> Existing dev/test DBs have data in the dropped tables — that's fine, the data was
> seeded-from-config anyway and is now redundant. No data migration needed (the 6
> section photos in current dev DB are placeholders/unset; the school sets real ones
> post-deploy).

## Admin photo editor (Phase 5) — rewired, not removed

- `page-section-actions.ts`: import from `section-photo-repo` instead of
  `page-section-repo`; `usedInTable:'PageSection'` → `'SectionPhoto'`. Logic otherwise
  identical (withRole, Zod patch, prev-read, set, syncPhotoUsage, audit, revalidate).
- `pages/page.tsx`: load slot photos via `getSectionPhoto`/`getAllSectionPhotos`.
- `PageSectionPhotoManager.tsx`: unchanged (still calls `updatePageSectionPhotoAction`).
- `photo-patch.ts` (`PAGE_PHOTO_SLOTS` + `pageSectionPhotoPatchSchema`): unchanged —
  it's the slot catalog/validator, storage-agnostic.

## File manifest

**Delete:**
- `src/lib/data/repositories/page-section-repo.ts`
- `src/lib/data/repositories/site-repo.ts`
- `src/__tests__/integration/repositories/page-section-repo.test.ts`
- `src/__tests__/integration/repositories/page-section-photo.test.ts`
- `src/__tests__/integration/repositories/site-repo.test.ts` (confirmed present)

**Create:**
- `src/lib/data/repositories/section-photo-repo.ts`
- `src/__tests__/integration/repositories/section-photo-repo.test.ts`
- migration `<ts>_static_text_to_config`

**Modify:**
- `prisma/schema.prisma` — drop PageSection/SiteConfig/Navigation; add SectionPhoto
- `src/lib/data/assemblers/{home,profil,akademik,fasilitas,kontak}.ts` — config + photo overlay
- `src/lib/data/ApiContentProvider.ts` — `getSiteConfig()` returns config; section assemblers unchanged signature
- `src/app/(admin)/admin/entities/_actions/page-section-actions.ts` — new repo + usedInTable
- `src/app/(admin)/admin/entities/pages/page.tsx` — new repo
- `scripts/seed-content.ts` — remove PageSection/SiteConfig/Navigation seeding
- `scripts/cleanup-seed.ts` — remove any deleteMany on the 3 dropped tables (verify + update)
- `src/__tests__/integration/seed-content.test.ts` — remove pageSection/siteConfig/navigation
  deleteMany/count + the `site===1`/`nav===1`/`sections>20` assertions
- `src/config/site.ts` / `src/config/navigation.ts` — verify completeness (no edits expected;
  config/site.ts already embeds `navigation`, includes `/mading`)

**Unchanged (verify):** render components (branch on `photo?.kind`), `photo-patch.ts`
(`PAGE_PHOTO_SLOTS` + patch schema — storage-agnostic), `_photo-columns.ts`,
`PageSectionPhotoManager.tsx`, `getContentProvider.test.ts` (ApiContentProvider stays),
all entity CRUD, MediaAsset/MediaUsage/DocumentSlot.

**Cache-tag note (M5):** the assembler-level `page:<key>` cache (old
`page-section-repo`) is gone. Entity actions still call `revalidateTag('page:<key>')`
— these become harmless no-ops; entity freshness now relies on each entity repo's own
cache/tags (unchanged). `revalidateTag('site-config')`/`('navigation')` have ZERO
callers (only mentioned in deleted site-repo), so dropping them is clean. The migration
may include a defensive `DELETE FROM MediaUsage WHERE usedInTable='PageSection'`
(0 rows in current dev DB — verified — but future-proof).

## Testing

- **Unit:** assembler-level not easily unit-tested (they hit config + DB); rely on
  integration + build.
- **Integration (MySQL):** `section-photo-repo.test.ts` — set→get round-trip
  (url-kind with crop, gradient-kind), unset returns null, overwrite, getAll shape.
  Update/remove the deleted PageSection tests.
- **Build/visual:** `next build` green; smoke `/`, `/profil`, `/akademik`,
  `/fasilitas`, `/kontak`, `/mading` render identical text; the admin "Halaman & Foto"
  editor sets a photo and it appears on the public page (overlay works); reset to
  gradient returns to placeholder.

## Risk & mitigation

- **Risk:** an assembler's entity-merge logic accidentally dropped during rewrite →
  home loses its gallery/achievements. **Mitigation:** rewrite each assembler by
  preserving its existing entity-fetch lines verbatim, changing only the section
  source; verify each public page renders post-change.
- **Risk:** `SectionPhoto` upsert vs old read-modify-write (row may not exist) →
  handled by `upsert`.
- **Risk:** config `siteConfig` shape differs from the Zod-validated merged shape →
  verify `StaticContentProvider.getSiteConfig()` already returns it cleanly (it does;
  static mode used it before Phase 1).
