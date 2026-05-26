# Phase 1: Data Migration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [2026-05-26-admin-dashboard-design.md](../specs/2026-05-26-admin-dashboard-design.md) (Phase 1 section + Section 4 Data model)

**Goal:** Migrate public site dari `StaticContentProvider` (membaca `src/config/`) ke `ApiContentProvider` (membaca Postgres via Prisma). Public site harus tetap render **visually identical** (verified via Playwright screenshot diff). CTA "Info PPDB" diganti "Kontak". Tidak ada UI changes selain CTA — perubahan murni data source.

**Architecture:**
- **Schema**: tambah model `PageSection` (JSONB), `SiteConfig` (singleton JSONB), `Navigation` (singleton JSONB), dan tabel entity (`Teacher`, `Achievement`, `Extracurricular`, `Subject`, `Faq`, `GalleryItem`, `Facility`, `OrganizationMember`, `DocumentSlot`, `MediaAsset`, `MediaUsage`). Migration tunggal `phase1_content_schema`.
- **Per-page entity scoping**: list-of-IDs untuk entity yang muncul di multiple pages (Achievement appears di home featured + profil full list; GalleryItem appears di home + fasilitas) disimpan dalam JSONB PageSection (`achievementsMeta.featuredIds`, `galleryMeta.featuredIds`). Repo accept ID array filter. Mencegah "home shows all 11 achievements when static showed 5" bug.
- **Ordering**: `Teacher.categoryOrder` dan `Extracurricular.categoryOrder` (int columns) menyimpan **explicit display order per category** (pimpinan → guru → tu, bukan alphabetical). Repo `ORDER BY [categoryOrder, order]`, bukan `[category, order]`.
- **Read layer**: tipis-tipis. Tiap entity punya **repository file** (`*-repo.ts`). Tiap page punya **assembler** (`assemblers/*.ts`) yang compose data dari repositories + page sections → mengembalikan exact shape `HomePageConfig`/`ProfilePageConfig`/dst dari `src/config/types.ts`.
- **Zod schemas** mirror `types.ts` — dipakai untuk validate JSONB sebelum insert (seed) dan akan dipakai untuk form validation di Phase 2.
- **Caching**: `unstable_cache` dengan tags per-page dan per-entity. Phase 1 belum invalidate (CRUD baru di Phase 2), tapi tag sudah diset supaya Phase 2 tinggal panggil `revalidateTag`.

**Tech Stack:** Prisma 6 • Postgres 16 • Zod • Next.js 15 `unstable_cache` • TypeScript strict

**Deliverable:** `NEXT_PUBLIC_DATA_SOURCE=api` di production. Public site identik dengan Phase 0 output. CTA Info PPDB → Kontak. Seed idempotent. Visual regression baseline captured.

**Bukan scope Phase 1:**
- CRUD UI (Phase 2)
- Cache invalidation pada save (Phase 2)
- Media library Cloudinary (Phase 3)
- Inline editor (Phase 4)

---

## Chunk 1: Schema + migration + seed

### Task 1: Pre-flight + planning baseline screenshots

**Why:** Visual regression diff butuh baseline. Capture screenshot SEBELUM switch ke `api`, supaya kalau setelah switch ada drift visual, kita bisa diff.

**Files:**
- Create: `playwright/tests/visual-baseline.spec.ts`
- Verify: test postgres running

- [ ] **Step 1.1: Verify test postgres running**

Run: `docker compose -f docker-compose.test.yml ps`
Expected: STATUS `Up X seconds (healthy)`.

If not running: `docker compose -f docker-compose.test.yml up -d` and wait until healthy.

- [ ] **Step 1.2: Verify Phase 0 still works**

Run:
```bash
DATABASE_URL="postgresql://test:test@localhost:5433/smpn3_test?schema=public" npx prisma migrate deploy
npm run lint
npm run typecheck
npm test
```

Expected: all green.

- [ ] **Step 1.3: Create visual baseline test**

Create `playwright/tests/visual-baseline.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

// Visual baseline: captured BEFORE Phase 1 data-source switch.
// After switching to api, re-run to diff. Failures mean public-site drift.
// To regenerate baselines intentionally: rm -rf playwright/tests/visual-baseline.spec.ts-snapshots/
// and run: npm run e2e -- --update-snapshots

const PAGES = ['/', '/profil', '/akademik', '/fasilitas', '/kontak'];

test.describe('public site visual baseline', () => {
  for (const path of PAGES) {
    test(`${path} matches baseline`, async ({ page }) => {
      await page.goto(path);
      // Wait for fonts to load to keep snapshot stable.
      await page.evaluate(() => document.fonts.ready);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveScreenshot(`${path.replace(/\//g, '_') || '_root'}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.01,
        animations: 'disabled',
      });
    });
  }
});
```

- [ ] **Step 1.4: Run baseline once to capture screenshots**

**Important**: Playwright doesn't have `--testPathPattern` (that's Jest). Pass the file path positionally or use `-g`/`--grep`.

Run: `npm run e2e -- playwright/tests/visual-baseline.spec.ts --update-snapshots`
Expected: snapshots created at `playwright/tests/visual-baseline.spec.ts-snapshots/`. All 5 tests "pass" (first run creates baseline).

If `npm run e2e` fails because dev server doesn't start, check that test postgres is running.

- [ ] **Step 1.5: Re-run to verify baseline is stable**

Run: `npm run e2e -- playwright/tests/visual-baseline.spec.ts`
Expected: 5 tests pass cleanly.

If tests fail unexpectedly (e.g., navbar pixel diff under the 1% threshold but visible to the eye), tighten `maxDiffPixelRatio: 0.001` in the spec, or use `maxDiffPixels: 50` for absolute pixel count. Re-capture with `--update-snapshots` after tightening.

- [ ] **Step 1.6: Commit baseline + test**

```bash
git add playwright/tests/visual-baseline.spec.ts \
        playwright/tests/visual-baseline.spec.ts-snapshots/
git commit -m "test(e2e): capture public-site visual baseline (pre phase 1 switch)"
```

---

### Task 2: Extend Prisma schema with Phase 1 content tables

**Why:** Add all content tables in one migration so we don't ship partial schema. Phase 1 needs: PageSection (JSONB), SiteConfig + Navigation (singleton JSONB), and all entity tables.

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_phase1_content_schema/`

- [ ] **Step 2.1: Add schema additions to `prisma/schema.prisma`**

Append to `prisma/schema.prisma` (after existing models, before final EOF):

```prisma
// ─── Phase 1: Page content (JSONB) ───

model PageSection {
  id         String   @id @default(cuid())
  pageKey    String   // "home" | "profil" | "akademik" | "fasilitas" | "kontak"
  sectionKey String   // e.g. "hero" | "stats" | "sambutan" | ...
  data       Json     // Zod-validated shape (see src/lib/validation/schemas/page-sections/)
  updatedAt  DateTime @updatedAt
  updatedBy  String?  // userId; nullable so seed without a user is allowed

  @@unique([pageKey, sectionKey])
}

model SiteConfig {
  id        String   @id @default("singleton")
  data      Json     // SiteConfig shape (see src/lib/validation/schemas/site-config.ts)
  updatedAt DateTime @updatedAt
  updatedBy String?
}

model Navigation {
  id        String   @id @default("singleton")
  items     Json     // NavItem[]
  updatedAt DateTime @updatedAt
  updatedBy String?
}

// ─── Phase 1: Entity tables ───

model Teacher {
  id            String   @id @default(cuid())
  name          String
  position      String
  badge         String
  category      String   // "pimpinan" | "guru" | "tu"
  // Explicit display order per category. Static config has pimpinan first,
  // then guru, then tu — alphabetical sort by category would reorder. Seed
  // sets categoryOrder = 0 for pimpinan, 1 for guru, 2 for tu.
  categoryOrder Int      @default(0)
  photoKind     String   // "url" | "gradient"
  photoSrc      String?
  photoAlt      String?
  photoFrom     String?
  photoTo       String?
  photoEmoji    String?
  order         Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([categoryOrder, order])
}

model Achievement {
  id        String   @id @default(cuid())
  year      Int
  title     String
  recipient String
  organizer String
  level     String   // "kabupaten" | "provinsi" | "nasional" | "internasional"
  icon      String
  order     Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([year, order])
}

model Extracurricular {
  id            String   @id @default(cuid())
  name          String
  category      String   // "wajib" | "olahraga" | "seni" | "akademik" | "keagamaan" | "lainnya"
  // Explicit display order per category. Static order: wajib → olahraga →
  // seni → akademik → keagamaan → lainnya. Alphabetical would put akademik
  // first. Seed sets categoryOrder by enum index.
  categoryOrder Int      @default(0)
  description   String
  pembina       String
  schedule      String
  achievement   String?
  icon          String
  order         Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([categoryOrder, order])
}

model Subject {
  id        String   @id @default(cuid())
  grade     Int      // 7 | 8 | 9
  groupId   String   // arbitrary group like "kelompok-a"
  groupTitle String
  name      String
  icon      String
  iconBg    String
  hours     String
  order     Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([grade, order])
}

model Faq {
  id        String   @id @default(cuid())
  question  String
  answer    String
  category  String   // "ppdb" | "akademik" | "administrasi" | "lainnya"
  order     Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([category, order])
}

model GalleryItem {
  id           String   @id @default(cuid())
  caption      String
  emoji        String
  gradientFrom String
  gradientTo   String
  category     String?  // optional category tag (e.g. "akademik", "ekskul", "fasilitas")
  span         String?  // "wide" | "tall" | "normal" — visual hint
  order        Int      @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([category, order])
}

model Facility {
  id           String   @id @default(cuid())
  kind         String   // "featured" | "mini"
  name         String
  description  String?  // only used when kind="featured"
  emoji        String?  // only used when kind="featured"
  gradientFrom String?  // only used when kind="featured"
  gradientTo   String?  // only used when kind="featured"
  span         String?  // only used when kind="featured" — "wide" | "tall" | "normal"
  icon         String?  // only used when kind="mini"
  order        Int      @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([kind, order])
}

model OrganizationMember {
  id        String                @id @default(cuid())
  name      String
  role      String                // job title shown in org chart
  level     Int                   // depth in chart, 0 = top
  parentId  String?
  parent    OrganizationMember?   @relation("OrgTree", fields: [parentId], references: [id], onDelete: SetNull)
  children  OrganizationMember[]  @relation("OrgTree")
  order     Int                   @default(0)
  createdAt DateTime              @default(now())
  updatedAt DateTime              @updatedAt

  @@index([level, order])
}

model DocumentSlot {
  id        String   @id  // "kalender-akademik" | "tata-tertib"
  mediaId   String?       // references MediaAsset; null = no file uploaded yet
  updatedAt DateTime @updatedAt
  updatedBy String?
}

// ─── Phase 1: Media skeleton (used in Phase 3) ───
// Included now so Phase 3 doesn't need its own migration.

model MediaAsset {
  id          String         @id @default(cuid())
  kind        String         // "image" | "pdf"
  url         String
  publicId    String         @unique
  hash        String         @unique
  alt         String?
  filename    String
  sizeBytes   Int
  mimeType    String
  width       Int?
  height      Int?
  uploadedBy  String
  createdAt   DateTime       @default(now())
  usages      MediaUsage[]
}

model MediaUsage {
  id          String     @id @default(cuid())
  mediaId     String
  usedInTable String
  usedInId    String
  usedInField String
  media       MediaAsset @relation(fields: [mediaId], references: [id], onDelete: Cascade)

  @@unique([mediaId, usedInTable, usedInId, usedInField])
  @@index([mediaId])
  @@index([usedInTable, usedInId])
}
```

- [ ] **Step 2.2: Generate + apply migration**

Run:
```bash
DATABASE_URL="postgresql://test:test@localhost:5433/smpn3_test?schema=public" \
  npx prisma migrate dev --name phase1_content_schema
```

Expected: new folder `prisma/migrations/<timestamp>_phase1_content_schema/` created with `migration.sql`. Prisma client regenerated.

- [ ] **Step 2.3: Verify migration SQL**

Run: `ls prisma/migrations/ | grep phase1`
Expected: 1 folder.

Run: `grep -l "CREATE TABLE \"Teacher\"\|CREATE TABLE \"PageSection\"\|CREATE TABLE \"MediaAsset\"" prisma/migrations/*_phase1_content_schema/migration.sql`
Expected: file matches (all three tables present).

- [ ] **Step 2.4: Typecheck (Prisma client types should be available)**

Run: `npm run typecheck`
Expected: no errors. New models accessible via `prisma.teacher`, `prisma.pageSection`, etc.

- [ ] **Step 2.5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): phase 1 content schema (PageSection, entities, MediaAsset)"
```

---

### Task 3: Zod schemas — shared primitives + SiteConfig + Navigation

**Why:** Zod schemas mirror `src/config/types.ts`. Phase 1 uses them in seed (validate JSONB before insert). Phase 2 will reuse for form validation. Single source of truth for shape.

**Files:**
- Create: `src/lib/validation/schemas/shared.ts`
- Create: `src/lib/validation/schemas/site-config.ts`
- Create: `src/lib/validation/schemas/navigation.ts`
- Create: `src/__tests__/lib/validation/site-config.test.ts`

- [ ] **Step 3.1: Write failing test for SiteConfig schema**

Create `src/__tests__/lib/validation/site-config.test.ts`:
```ts
import { siteConfigSchema } from '@/lib/validation/schemas/site-config';
import { siteConfig } from '@config/site';

describe('siteConfigSchema', () => {
  it('accepts the existing static siteConfig after kontakCta rename', () => {
    // Phase 1: ppdbCta is removed and replaced with kontakCta.
    // This test passes BEFORE Task 4 (because we synthesize kontakCta below)
    // and AFTER Task 4 (because the destructure of a missing field is undefined).
    const { ppdbCta: _omit, ...rest } = siteConfig as typeof siteConfig & {
      ppdbCta?: unknown;
    };
    void _omit;
    const candidate = {
      ...rest,
      kontakCta: { label: 'Kontak', href: '/kontak' },
    };
    const result = siteConfigSchema.safeParse(candidate);
    if (!result.success) {
      throw new Error('Zod failed: ' + JSON.stringify(result.error.format(), null, 2));
    }
    expect(result.success).toBe(true);
  });

  // This test asserts the rename actually happened in src/config/site.ts.
  // Skipped pre-Task-4, enabled at Task 4. Catches a regression where someone
  // re-adds ppdbCta to site.ts later.
  it.skip('static siteConfig no longer has ppdbCta (Phase 1 contract)', () => {
    expect((siteConfig as Record<string, unknown>).ppdbCta).toBeUndefined();
    expect((siteConfig as unknown as { kontakCta: unknown }).kontakCta).toBeDefined();
  });

  it('rejects missing required fields', () => {
    expect(siteConfigSchema.safeParse({}).success).toBe(false);
  });

  it('rejects invalid social platform', () => {
    const candidate = {
      brand: { name: 'x', shortName: 'x', location: 'x', tagline: 'x', logoMark: 'x' },
      navigation: [],
      kontakCta: { label: 'Kontak', href: '/kontak' },
      contact: {
        address: 'x', addressLines: ['x'], phone: 'x', phoneHref: 'x',
        whatsapp: 'x', email: 'x@x.com', hours: 'x', hoursDetail: 'x',
        mapsUrl: 'http://x', directionsUrl: 'http://x',
      },
      social: [{ platform: 'discord', url: 'http://x', handle: 'x', icon: 'x', cta: 'x' }],
      accreditation: { grade: 'A', body: 'x', label: 'x' },
      footer: { copyright: 'x', designedBy: 'x' },
    };
    expect(siteConfigSchema.safeParse(candidate).success).toBe(false);
  });
});
```

- [ ] **Step 3.2: Run test, expect FAIL**

Run: `npm test -- --testPathPattern='validation/site-config'`
Expected: FAIL — `Cannot find module '@/lib/validation/schemas/site-config'`.

- [ ] **Step 3.3: Implement shared primitives**

Create `src/lib/validation/schemas/shared.ts`:
```ts
import { z } from 'zod';

export const ctaLinkSchema = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
  icon: z.string().optional(),
});

export const ctaFinalSchema = z.object({
  title: z.string().min(1),
  titleLines: z.array(z.string()).optional(),
  subtitle: z.string(),
  primary: ctaLinkSchema,
  secondary: ctaLinkSchema.optional(),
});

export const sectionMetaSchema = z.object({
  eyebrow: z.string().optional(),
  title: z.string().min(1),
  subtitle: z.string().optional(),
});

export const photoSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('url'), src: z.string().min(1), alt: z.string() }),
  z.object({
    kind: z.literal('gradient'),
    from: z.string().min(1),
    to: z.string().min(1),
    emoji: z.string().min(1),
  }),
]);

export const pageHeaderSchema = z.object({
  breadcrumb: z.array(z.object({ label: z.string(), href: z.string().optional() })),
  title: z.string().min(1),
  subtitle: z.string(),
});

export const contactCardSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('address'),
    icon: z.string(),
    label: z.string(),
    value: z.string(),
    sub: z.string(),
    href: z.string().optional(),
    linkText: z.string().optional(),
  }),
  z.object({
    kind: z.literal('phone'),
    icon: z.string(),
    label: z.string(),
    value: z.string(),
    sub: z.string(),
    href: z.string(),
    linkText: z.string().optional(),
  }),
  z.object({
    kind: z.literal('email'),
    icon: z.string(),
    label: z.string(),
    value: z.string(),
    sub: z.string(),
    href: z.string(),
    linkText: z.string().optional(),
  }),
  z.object({
    kind: z.literal('hours'),
    icon: z.string(),
    label: z.string(),
    value: z.string(),
    sub: z.string(),
    subTone: z.enum(['muted', 'warn']).optional(),
  }),
]);
```

- [ ] **Step 3.4: Implement Navigation schema**

Create `src/lib/validation/schemas/navigation.ts`:
```ts
import { z } from 'zod';

export const routeSchema = z.enum(['/', '/profil', '/akademik', '/fasilitas', '/kontak']);

export const navItemSchema = z.object({
  label: z.string().min(1),
  href: routeSchema,
});

export const navigationSchema = z.array(navItemSchema);

export type NavigationValidated = z.infer<typeof navigationSchema>;
```

- [ ] **Step 3.5: Implement SiteConfig schema (Phase 1: ppdbCta → kontakCta)**

Create `src/lib/validation/schemas/site-config.ts`:
```ts
import { z } from 'zod';
import { navItemSchema } from './navigation';

export const siteConfigSchema = z.object({
  brand: z.object({
    name: z.string().min(1),
    shortName: z.string().min(1),
    location: z.string(),
    tagline: z.string(),
    logoMark: z.string().min(1),
  }),
  navigation: z.array(navItemSchema),
  // CHANGED in Phase 1: ppdbCta removed, replaced with kontakCta.
  kontakCta: z.object({ label: z.string().min(1), href: z.string().min(1) }),
  contact: z.object({
    address: z.string(),
    addressLines: z.array(z.string()),
    phone: z.string(),
    phoneHref: z.string(),
    whatsapp: z.string(),
    email: z.string().email(),
    hours: z.string(),
    hoursDetail: z.string(),
    mapsUrl: z.string().url(),
    directionsUrl: z.string().url(),
  }),
  social: z.array(z.object({
    platform: z.enum(['instagram', 'facebook', 'youtube', 'tiktok']),
    url: z.string().url(),
    handle: z.string(),
    icon: z.string(),
    cta: z.string(),
  })),
  accreditation: z.object({
    grade: z.enum(['A', 'B', 'C']),
    body: z.string(),
    label: z.string(),
  }),
  footer: z.object({
    copyright: z.string(),
    designedBy: z.string(),
  }),
});

export type SiteConfigValidated = z.infer<typeof siteConfigSchema>;
```

- [ ] **Step 3.6: Run test, expect PASS**

Run: `npm test -- --testPathPattern='validation/site-config'`
Expected: 3 tests pass.

- [ ] **Step 3.7: Commit**

```bash
git add src/lib/validation/ src/__tests__/lib/validation/
git commit -m "feat(validation): zod schemas for shared primitives + SiteConfig + Navigation"
```

---

### Task 4: Update SiteConfig type + CTA (PPDB → Kontak)

**Why:** Stakeholder requested CTA change. Phase 1 is the right time to make this breaking type change because we're also migrating the config to DB.

**Files:**
- Modify: `src/config/types.ts`
- Modify: `src/config/site.ts`
- Modify: `src/components/organisms/Navbar.tsx`

- [ ] **Step 4.1: Update `SiteConfig` type**

In `src/config/types.ts`, find:
```ts
export interface SiteConfig {
  brand: BrandInfo;
  navigation: NavItem[];
  ppdbCta: { label: string; href: string };
  contact: ContactInfo;
  ...
}
```

Replace `ppdbCta:` line with:
```ts
  kontakCta: { label: string; href: string };
```

- [ ] **Step 4.2: Update `src/config/site.ts`**

Find:
```ts
  ppdbCta: { label: 'Info PPDB', href: '/kontak' },
```

Replace with:
```ts
  kontakCta: { label: 'Kontak', href: '/kontak' },
```

- [ ] **Step 4.3: Update Navbar component**

In `src/components/organisms/Navbar.tsx`, replace all `site.ppdbCta` → `site.kontakCta`.

Use this command:
```bash
sed -i.bak 's/site\.ppdbCta/site.kontakCta/g' src/components/organisms/Navbar.tsx && rm src/components/organisms/Navbar.tsx.bak
```

Verify: `grep -n "ppdbCta\|kontakCta" src/components/organisms/Navbar.tsx` should show only `kontakCta`.

- [ ] **Step 4.4: Enable the ppdbCta-absence test from Task 3**

Edit `src/__tests__/lib/validation/site-config.test.ts`: change `it.skip('static siteConfig no longer has ppdbCta...'` to `it('static siteConfig no longer has ppdbCta...'`. The test now actively guards against re-adding `ppdbCta` to `site.ts`.

Use sed:
```bash
sed -i.bak "s|it.skip('static siteConfig no longer has ppdbCta|it('static siteConfig no longer has ppdbCta|" src/__tests__/lib/validation/site-config.test.ts && rm src/__tests__/lib/validation/site-config.test.ts.bak
```

- [ ] **Step 4.5: Typecheck + tests**

Run: `npm run typecheck && npm test`
Expected: no errors. The newly-enabled regression test passes (because Step 4.2 already renamed `ppdbCta` → `kontakCta` in site.ts).

- [ ] **Step 4.5.1: Run build smoke**

Run: `SKIP_ENV_VALIDATION=true npm run build`
Expected: build succeeds.

- [ ] **Step 4.6: Re-run visual baseline — expect failure due to Navbar CTA label change**

Run: `npm run e2e -- playwright/tests/visual-baseline.spec.ts`
Expected: tests **FAIL** on all 5 pages because the navbar CTA label changed from "Info PPDB" to "Kontak".

**If tests unexpectedly PASS** (pixel diff under threshold): the safety net is broken. Tighten `maxDiffPixelRatio` to `0.001` or add `maxDiffPixels: 50` in `visual-baseline.spec.ts`, then re-run.

When FAIL is confirmed, update the baselines:
```bash
npm run e2e -- playwright/tests/visual-baseline.spec.ts --update-snapshots
```

Re-run to confirm: `npm run e2e -- playwright/tests/visual-baseline.spec.ts` — should all pass now with new baselines.

- [ ] **Step 4.7: Commit**

```bash
git add src/config/types.ts src/config/site.ts src/components/organisms/Navbar.tsx \
        src/__tests__/lib/validation/site-config.test.ts \
        playwright/tests/visual-baseline.spec.ts-snapshots/
git commit -m "feat(site): rename ppdbCta to kontakCta + update baseline"
```

---

## Chunk 2: Repositories + entity Zod schemas

### Task 5: Zod schemas for entities

**Why:** Each entity gets its own Zod schema. These will be used by repositories (to validate DB rows on read) and by seed (to validate input before insert).

**Files:** (8 schema files + 1 test file)
- Create: `src/lib/validation/schemas/entities/teacher.ts`
- Create: `src/lib/validation/schemas/entities/achievement.ts`
- Create: `src/lib/validation/schemas/entities/extracurricular.ts`
- Create: `src/lib/validation/schemas/entities/subject.ts`
- Create: `src/lib/validation/schemas/entities/faq.ts`
- Create: `src/lib/validation/schemas/entities/gallery-item.ts`
- Create: `src/lib/validation/schemas/entities/facility.ts`
- Create: `src/lib/validation/schemas/entities/organization-member.ts`
- Create: `src/__tests__/lib/validation/entities.test.ts`

- [ ] **Step 5.1: Write failing test covering all 8 schemas**

Create `src/__tests__/lib/validation/entities.test.ts`:
```ts
import { teacherSchema } from '@/lib/validation/schemas/entities/teacher';
import { achievementSchema } from '@/lib/validation/schemas/entities/achievement';
import { extracurricularSchema } from '@/lib/validation/schemas/entities/extracurricular';
import { subjectSchema } from '@/lib/validation/schemas/entities/subject';
import { faqSchema } from '@/lib/validation/schemas/entities/faq';
import { galleryItemSchema } from '@/lib/validation/schemas/entities/gallery-item';
import { facilitySchema } from '@/lib/validation/schemas/entities/facility';
import { organizationMemberSchema } from '@/lib/validation/schemas/entities/organization-member';

describe('entity Zod schemas', () => {
  it('teacherSchema accepts gradient photo', () => {
    expect(teacherSchema.safeParse({
      id: 'g1', name: 'Bu Siti', position: 'Guru Matematika', badge: 'S.Pd.',
      category: 'guru', photo: { kind: 'gradient', from: '#DBEAFE', to: '#93C5FD', emoji: '👩‍🏫' },
    }).success).toBe(true);
  });

  it('teacherSchema rejects unknown category', () => {
    expect(teacherSchema.safeParse({
      id: 'g1', name: 'X', position: 'Y', badge: 'Z',
      category: 'kepala', photo: { kind: 'gradient', from: '#000', to: '#fff', emoji: '👤' },
    }).success).toBe(false);
  });

  it('achievementSchema accepts valid input', () => {
    expect(achievementSchema.safeParse({
      id: 'a1', year: 2024, title: 'Juara 1', recipient: 'Tim',
      organizer: 'Kemendikbud', level: 'nasional', icon: '🏆',
    }).success).toBe(true);
  });

  it('extracurricularSchema accepts optional achievement', () => {
    const base = {
      id: 'e1', name: 'Pramuka', category: 'wajib', description: 'd',
      pembina: 'Pak X', schedule: 'Sabtu', icon: '⛺',
    };
    expect(extracurricularSchema.safeParse(base).success).toBe(true);
    expect(extracurricularSchema.safeParse({ ...base, achievement: 'Juara 1' }).success).toBe(true);
  });

  it('subjectSchema accepts kelas7-9', () => {
    expect(subjectSchema.safeParse({
      id: 's1', grade: 7, groupId: 'kelompok-a', groupTitle: 'Kelompok A',
      name: 'Matematika', icon: '📐', iconBg: '#DBEAFE', hours: '5 JP',
    }).success).toBe(true);
  });

  it('subjectSchema rejects grade outside 7-9', () => {
    expect(subjectSchema.safeParse({
      id: 's1', grade: 6, groupId: 'x', groupTitle: 'x',
      name: 'x', icon: 'x', iconBg: 'x', hours: 'x',
    }).success).toBe(false);
  });

  it('faqSchema accepts valid input', () => {
    expect(faqSchema.safeParse({
      id: 'f1', question: 'Q', answer: 'A', category: 'ppdb',
    }).success).toBe(true);
  });

  it('galleryItemSchema accepts optional span', () => {
    const base = {
      id: 'g1', caption: 'c', emoji: '🎓', gradientFrom: '#000', gradientTo: '#fff',
    };
    expect(galleryItemSchema.safeParse(base).success).toBe(true);
    expect(galleryItemSchema.safeParse({ ...base, span: 'wide' }).success).toBe(true);
    expect(galleryItemSchema.safeParse({ ...base, span: 'invalid' }).success).toBe(false);
  });

  it('facilitySchema discriminates featured vs mini', () => {
    expect(facilitySchema.safeParse({
      kind: 'featured', id: 'f1', name: 'Lab', description: 'd',
      emoji: '🔬', gradientFrom: '#000', gradientTo: '#fff',
    }).success).toBe(true);
    expect(facilitySchema.safeParse({
      kind: 'mini', id: 'f2', name: 'Kantin', icon: '🍽️',
    }).success).toBe(true);
  });

  it('organizationMemberSchema accepts valid input', () => {
    expect(organizationMemberSchema.safeParse({
      id: 'o1', name: 'Pak X', role: 'Kepala Sekolah', level: 0, parentId: null,
    }).success).toBe(true);
  });
});
```

- [ ] **Step 5.2: Run test, expect FAIL**

Run: `npm test -- --testPathPattern='validation/entities'`
Expected: FAIL — modules not found.

- [ ] **Step 5.3: Implement all 8 entity schemas**

Create `src/lib/validation/schemas/entities/teacher.ts`:
```ts
import { z } from 'zod';
import { photoSchema } from '../shared';

export const teacherSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  position: z.string().min(1),
  badge: z.string(),
  category: z.enum(['pimpinan', 'guru', 'tu']),
  photo: photoSchema,
});

export type TeacherValidated = z.infer<typeof teacherSchema>;
```

Create `src/lib/validation/schemas/entities/achievement.ts`:
```ts
import { z } from 'zod';

export const achievementLevelSchema = z.enum([
  'kabupaten', 'provinsi', 'nasional', 'internasional',
]);

export const achievementSchema = z.object({
  id: z.string().min(1),
  year: z.number().int().min(2000).max(2100),
  title: z.string().min(1),
  recipient: z.string().min(1),
  organizer: z.string().min(1),
  level: achievementLevelSchema,
  icon: z.string().min(1),
});

export type AchievementValidated = z.infer<typeof achievementSchema>;
```

Create `src/lib/validation/schemas/entities/extracurricular.ts`:
```ts
import { z } from 'zod';

export const ekskulCategorySchema = z.enum([
  'wajib', 'olahraga', 'seni', 'akademik', 'keagamaan', 'lainnya',
]);

export const extracurricularSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: ekskulCategorySchema,
  description: z.string(),
  pembina: z.string(),
  schedule: z.string(),
  achievement: z.string().optional(),
  icon: z.string().min(1),
});

export type ExtracurricularValidated = z.infer<typeof extracurricularSchema>;
```

Create `src/lib/validation/schemas/entities/subject.ts`:
```ts
import { z } from 'zod';

export const subjectSchema = z.object({
  id: z.string().min(1),
  grade: z.union([z.literal(7), z.literal(8), z.literal(9)]),
  groupId: z.string().min(1),
  groupTitle: z.string().min(1),
  name: z.string().min(1),
  icon: z.string().min(1),
  iconBg: z.string().min(1),
  hours: z.string().min(1),
});

export type SubjectValidated = z.infer<typeof subjectSchema>;
```

Create `src/lib/validation/schemas/entities/faq.ts`:
```ts
import { z } from 'zod';

export const faqCategorySchema = z.enum(['ppdb', 'akademik', 'administrasi', 'lainnya']);

export const faqSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  answer: z.string().min(1),
  category: faqCategorySchema,
});

export type FaqValidated = z.infer<typeof faqSchema>;
```

Create `src/lib/validation/schemas/entities/gallery-item.ts`:
```ts
import { z } from 'zod';

export const galleryItemSchema = z.object({
  id: z.string().min(1),
  caption: z.string().min(1),
  emoji: z.string().min(1),
  gradientFrom: z.string().min(1),
  gradientTo: z.string().min(1),
  category: z.string().optional(),
  span: z.enum(['wide', 'tall', 'normal']).optional(),
});

export type GalleryItemValidated = z.infer<typeof galleryItemSchema>;
```

Create `src/lib/validation/schemas/entities/facility.ts`:
```ts
import { z } from 'zod';

export const facilitySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('featured'),
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1),
    emoji: z.string().min(1),
    gradientFrom: z.string().min(1),
    gradientTo: z.string().min(1),
    span: z.enum(['wide', 'tall', 'normal']).optional(),
  }),
  z.object({
    kind: z.literal('mini'),
    id: z.string().min(1),
    name: z.string().min(1),
    icon: z.string().min(1),
  }),
]);

export type FacilityValidated = z.infer<typeof facilitySchema>;
```

Create `src/lib/validation/schemas/entities/organization-member.ts`:
```ts
import { z } from 'zod';

export const organizationMemberSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.string().min(1),
  level: z.number().int().min(0).max(10),
  parentId: z.string().nullable(),
});

export type OrganizationMemberValidated = z.infer<typeof organizationMemberSchema>;
```

- [ ] **Step 5.4: Run test, expect PASS**

Run: `npm test -- --testPathPattern='validation/entities'`
Expected: 10 tests pass.

- [ ] **Step 5.5: Commit**

```bash
git add src/lib/validation/schemas/entities/ src/__tests__/lib/validation/entities.test.ts
git commit -m "feat(validation): zod schemas for all phase 1 entities"
```

---

### Task 6: Repository — site-repo (SiteConfig + Navigation read)

**Why:** Read singleton SiteConfig + Navigation from DB. Used by every page (footer + navbar). Wrapped in `unstable_cache` with tag `site-config` for Phase 2 invalidation.

**Files:**
- Create: `src/lib/data/repositories/site-repo.ts`
- Create: `src/__tests__/integration/repositories/site-repo.test.ts`

- [ ] **Step 6.1: Write failing integration test**

Create `src/__tests__/integration/repositories/site-repo.test.ts`:
```ts
import { prisma } from '@/lib/db/client';
import { siteConfig as staticSiteConfig } from '@config/site';
import { navigation as staticNavigation } from '@config/navigation';
import { getSiteConfig } from '@/lib/data/repositories/site-repo';

describe('siteRepo.getSiteConfig', () => {
  beforeAll(async () => {
    await prisma.siteConfig.deleteMany({});
    await prisma.navigation.deleteMany({});
    const { ppdbCta: _unused, ...rest } = staticSiteConfig as typeof staticSiteConfig & {
      ppdbCta?: unknown;
    };
    void _unused;
    await prisma.siteConfig.create({
      data: {
        id: 'singleton',
        data: { ...rest, kontakCta: { label: 'Kontak', href: '/kontak' } } as object,
      },
    });
    await prisma.navigation.create({
      data: { id: 'singleton', items: staticNavigation as unknown as object },
    });
  });

  afterAll(async () => {
    await prisma.siteConfig.deleteMany({});
    await prisma.navigation.deleteMany({});
    await prisma.$disconnect();
  });

  it('returns SiteConfig with kontakCta and joined navigation', async () => {
    const cfg = await getSiteConfig();
    expect(cfg.brand.name).toBe('SMPN 3 Kresek');
    expect(cfg.kontakCta).toEqual({ label: 'Kontak', href: '/kontak' });
    expect(cfg.navigation).toEqual(staticNavigation);
  });

  it('throws when SiteConfig row is missing', async () => {
    await prisma.siteConfig.deleteMany({});
    await expect(getSiteConfig()).rejects.toThrow(/SiteConfig/);
  });
});
```

- [ ] **Step 6.2: Run, expect FAIL**

Run: `npm run test:int -- --testPathPattern='repositories/site-repo'`
Expected: FAIL — module not found.

- [ ] **Step 6.3: Implement repository**

Create `src/lib/data/repositories/site-repo.ts`:
```ts
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/db/client';
import { siteConfigSchema } from '@/lib/validation/schemas/site-config';
import { navigationSchema } from '@/lib/validation/schemas/navigation';
import type { SiteConfig } from '@config/types';

async function loadSiteConfig(): Promise<SiteConfig> {
  const [siteRow, navRow] = await Promise.all([
    prisma.siteConfig.findUnique({ where: { id: 'singleton' } }),
    prisma.navigation.findUnique({ where: { id: 'singleton' } }),
  ]);
  if (!siteRow) throw new Error('SiteConfig singleton missing — seed not run?');
  if (!navRow) throw new Error('Navigation singleton missing — seed not run?');

  const navigation = navigationSchema.parse(navRow.items);
  const merged = { ...(siteRow.data as object), navigation };
  return siteConfigSchema.parse(merged) as SiteConfig;
}

/**
 * Read singleton SiteConfig (brand + contact + kontakCta + accreditation + …)
 * with the embedded Navigation list. Cached with tag `site-config` so Phase 2
 * mutations can call revalidateTag('site-config').
 */
export const getSiteConfig = unstable_cache(loadSiteConfig, ['site-config'], {
  tags: ['site-config', 'navigation'],
});
```

- [ ] **Step 6.4: Run integration test, expect PASS**

Run: `npm run test:int -- --testPathPattern='repositories/site-repo'`
Expected: 2 tests pass.

- [ ] **Step 6.5: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 6.6: Commit**

```bash
git add src/lib/data/repositories/site-repo.ts \
        src/__tests__/integration/repositories/site-repo.test.ts
git commit -m "feat(data): site-repo (SiteConfig + Navigation read with cache tag)"
```

---

### Task 7: Repository — page-section-repo (JSONB sections per page)

**Why:** Page content (hero, sambutan, stats, dll) lives as JSONB rows in `PageSection`. This repo loads all sections for a given `pageKey` and returns them keyed by `sectionKey`.

**Files:**
- Create: `src/lib/data/repositories/page-section-repo.ts`
- Create: `src/__tests__/integration/repositories/page-section-repo.test.ts`

- [ ] **Step 7.1: Write failing integration test**

Create `src/__tests__/integration/repositories/page-section-repo.test.ts`:
```ts
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
```

- [ ] **Step 7.2: Run, expect FAIL**

Run: `npm run test:int -- --testPathPattern='repositories/page-section-repo'`
Expected: FAIL — module not found.

- [ ] **Step 7.3: Implement repository**

Create `src/lib/data/repositories/page-section-repo.ts`:
```ts
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/db/client';

/**
 * Returns all PageSection rows for the given pageKey, keyed by sectionKey.
 * Sections are not Zod-validated here — that's the assembler's job, because each
 * sectionKey has a different shape and the assembler knows which schema to apply.
 */
export type SectionsByKey = Record<string, unknown>;

async function loadPageSections(pageKey: string): Promise<SectionsByKey> {
  const rows = await prisma.pageSection.findMany({ where: { pageKey } });
  const out: SectionsByKey = {};
  for (const row of rows) {
    out[row.sectionKey] = row.data;
  }
  return out;
}

export function getPageSections(pageKey: string): Promise<SectionsByKey> {
  // unstable_cache cannot take dynamic-key args in the cacheKey array, so we
  // build a per-pageKey wrapper. Tag with both 'page:<pageKey>' (specific) and
  // 'page-sections' (generic) so Phase 2 can invalidate either way.
  const cached = unstable_cache(
    () => loadPageSections(pageKey),
    ['page-sections', pageKey],
    { tags: [`page:${pageKey}`, 'page-sections'] },
  );
  return cached();
}
```

- [ ] **Step 7.4: Run integration test, expect PASS**

Run: `npm run test:int -- --testPathPattern='repositories/page-section-repo'`
Expected: 2 tests pass.

- [ ] **Step 7.5: Commit**

```bash
git add src/lib/data/repositories/page-section-repo.ts \
        src/__tests__/integration/repositories/page-section-repo.test.ts
git commit -m "feat(data): page-section-repo (JSONB sections per page)"
```

---

### Task 8: Repository — entity repos (Teacher, Achievement, Extracurricular)

**Why:** Each entity has its own read repository. Phase 1 only needs read (CRUD comes Phase 2). All wrapped with `unstable_cache` tagged by entity name.

**Files:**
- Create: `src/lib/data/repositories/teacher-repo.ts`
- Create: `src/lib/data/repositories/achievement-repo.ts`
- Create: `src/lib/data/repositories/extracurricular-repo.ts`
- Create: `src/__tests__/integration/repositories/entity-repos.test.ts`

- [ ] **Step 8.1: Write failing integration test**

Create `src/__tests__/integration/repositories/entity-repos.test.ts`:
```ts
import { prisma } from '@/lib/db/client';
import { getTeachers } from '@/lib/data/repositories/teacher-repo';
import { getAllAchievements, getAchievementsByIds } from '@/lib/data/repositories/achievement-repo';
import { getExtracurriculars } from '@/lib/data/repositories/extracurricular-repo';

describe('entity repositories', () => {
  beforeAll(async () => {
    await prisma.teacher.deleteMany({});
    await prisma.achievement.deleteMany({});
    await prisma.extracurricular.deleteMany({});

    await prisma.teacher.createMany({
      data: [
        { id: 't1', name: 'A', position: 'Guru', badge: 'S.Pd.', category: 'guru',
          categoryOrder: 1,
          photoKind: 'gradient', photoFrom: '#000', photoTo: '#fff', photoEmoji: '👤', order: 0 },
        { id: 't2', name: 'B', position: 'Kepsek', badge: 'M.Pd.', category: 'pimpinan',
          categoryOrder: 0,
          photoKind: 'gradient', photoFrom: '#000', photoTo: '#fff', photoEmoji: '👤', order: 0 },
      ],
    });
    await prisma.achievement.createMany({
      data: [
        { id: 'a1', year: 2023, title: 'X', recipient: 'Y', organizer: 'Z',
          level: 'nasional', icon: '🏆', order: 1 },
        { id: 'a2', year: 2024, title: 'A', recipient: 'B', organizer: 'C',
          level: 'kabupaten', icon: '🥇', order: 0 },
      ],
    });
    await prisma.extracurricular.create({
      data: { id: 'e1', name: 'Pramuka', category: 'wajib', categoryOrder: 0,
        description: 'd', pembina: 'X', schedule: 'Sabtu', icon: '⛺', order: 0 },
    });
  });

  afterAll(async () => {
    await prisma.teacher.deleteMany({});
    await prisma.achievement.deleteMany({});
    await prisma.extracurricular.deleteMany({});
    await prisma.$disconnect();
  });

  it('getTeachers returns Teacher[] with photo discriminator + ordered by [categoryOrder, order]', async () => {
    const teachers = await getTeachers();
    expect(teachers).toHaveLength(2);
    // Pimpinan has categoryOrder=0 (seeded ahead), Guru has categoryOrder=1.
    // Even though "guru" < "pimpinan" alphabetically, categoryOrder wins.
    expect(teachers[0]?.category).toBe('pimpinan');
    expect(teachers[0]?.photo).toEqual({ kind: 'gradient', from: '#000', to: '#fff', emoji: '👤' });
  });

  it('getAllAchievements returns ordered Achievement[]', async () => {
    const items = await getAllAchievements();
    expect(items).toHaveLength(2);
    expect(items[0]?.id).toBe('a2'); // order 0 first
  });

  it('getAchievementsByIds preserves caller order and drops unknown IDs', async () => {
    const items = await getAchievementsByIds(['a1', 'nonexistent', 'a2']);
    expect(items.map((i) => i.id)).toEqual(['a1', 'a2']);
  });

  it('getExtracurriculars returns shape matching types.ts', async () => {
    const items = await getExtracurriculars();
    expect(items[0]).toMatchObject({
      id: 'e1', name: 'Pramuka', category: 'wajib',
      pembina: 'X', schedule: 'Sabtu', icon: '⛺',
    });
    // No 'achievement' field in row → should be undefined (not null) per types.ts
    expect(items[0]?.achievement).toBeUndefined();
  });
});
```

- [ ] **Step 8.2: Run, expect FAIL**

Run: `npm run test:int -- --testPathPattern='repositories/entity-repos'`
Expected: FAIL.

- [ ] **Step 8.3: Implement teacher repo**

Create `src/lib/data/repositories/teacher-repo.ts`:
```ts
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/db/client';
import type { Teacher } from '@config/types';

function rowToTeacher(row: {
  id: string; name: string; position: string; badge: string; category: string;
  photoKind: string; photoSrc: string | null; photoAlt: string | null;
  photoFrom: string | null; photoTo: string | null; photoEmoji: string | null;
}): Teacher {
  let photo: Teacher['photo'];
  if (row.photoKind === 'url') {
    if (row.photoSrc === null || row.photoAlt === null) {
      throw new Error(`Teacher ${row.id}: photoKind=url requires photoSrc + photoAlt`);
    }
    photo = { kind: 'url', src: row.photoSrc, alt: row.photoAlt };
  } else if (row.photoKind === 'gradient') {
    if (row.photoFrom === null || row.photoTo === null || row.photoEmoji === null) {
      throw new Error(`Teacher ${row.id}: photoKind=gradient requires photoFrom + photoTo + photoEmoji`);
    }
    photo = { kind: 'gradient', from: row.photoFrom, to: row.photoTo, emoji: row.photoEmoji };
  } else {
    throw new Error(`Teacher ${row.id}: unknown photoKind "${row.photoKind}"`);
  }
  return {
    id: row.id, name: row.name, position: row.position, badge: row.badge,
    category: row.category as Teacher['category'], photo,
  };
}

async function loadTeachers(): Promise<Teacher[]> {
  // ORDER BY categoryOrder (explicit pimpinan-first/guru/tu) + intra-category order.
  // NOT by 'category' alphabetical — that would reorder pimpinan → guru → tu wrong.
  const rows = await prisma.teacher.findMany({
    orderBy: [{ categoryOrder: 'asc' }, { order: 'asc' }],
  });
  return rows.map(rowToTeacher);
}

export const getTeachers = unstable_cache(loadTeachers, ['teachers'], { tags: ['teachers'] });
```

- [ ] **Step 8.4: Implement achievement repo (with optional ID scoping)**

Create `src/lib/data/repositories/achievement-repo.ts`:
```ts
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/db/client';
import type { Achievement } from '@config/types';

function rowToAchievement(r: {
  id: string; year: number; title: string; recipient: string;
  organizer: string; level: string; icon: string;
}): Achievement {
  return {
    id: r.id, year: r.year, title: r.title, recipient: r.recipient,
    organizer: r.organizer, level: r.level as Achievement['level'], icon: r.icon,
  };
}

async function loadAllAchievements(): Promise<Achievement[]> {
  const rows = await prisma.achievement.findMany({ orderBy: [{ order: 'asc' }, { year: 'desc' }] });
  return rows.map(rowToAchievement);
}

/**
 * All achievements, ordered. Used by /profil's full prestasi list.
 */
export const getAllAchievements = unstable_cache(loadAllAchievements, ['achievements', 'all'], {
  tags: ['achievements'],
});

/**
 * Subset by explicit ID list, preserving the input order. Used by /home's
 * featured-5 list whose IDs are stored in PageSection.achievementsMeta.featuredIds.
 * Returns only achievements that actually exist; missing IDs are silently dropped.
 */
export function getAchievementsByIds(ids: readonly string[]): Promise<Achievement[]> {
  const cached = unstable_cache(
    async () => {
      const rows = await prisma.achievement.findMany({ where: { id: { in: [...ids] } } });
      const byId = new Map(rows.map((r) => [r.id, rowToAchievement(r)]));
      // Preserve caller-provided order.
      return ids.map((id) => byId.get(id)).filter((x): x is Achievement => x !== undefined);
    },
    ['achievements', 'by-ids', ids.join(',')],
    { tags: ['achievements'] },
  );
  return cached();
}
```

- [ ] **Step 8.5: Implement extracurricular repo**

Create `src/lib/data/repositories/extracurricular-repo.ts`:
```ts
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/db/client';
import type { Extracurricular } from '@config/types';

async function loadExtracurriculars(): Promise<Extracurricular[]> {
  // ORDER BY categoryOrder (wajib first, then olahraga/seni/akademik/keagamaan/lainnya)
  // + intra-category order. Static config order vs alphabetical-by-category differs.
  const rows = await prisma.extracurricular.findMany({
    orderBy: [{ categoryOrder: 'asc' }, { order: 'asc' }],
  });
  return rows.map((r) => {
    const base: Extracurricular = {
      id: r.id, name: r.name, category: r.category as Extracurricular['category'],
      description: r.description, pembina: r.pembina, schedule: r.schedule, icon: r.icon,
    };
    if (r.achievement) base.achievement = r.achievement;
    return base;
  });
}

export const getExtracurriculars = unstable_cache(
  loadExtracurriculars, ['extracurriculars'], { tags: ['extracurriculars'] },
);
```

- [ ] **Step 8.6: Run integration test, expect PASS**

Run: `npm run test:int -- --testPathPattern='repositories/entity-repos'`
Expected: 3 tests pass.

- [ ] **Step 8.7: Commit**

```bash
git add src/lib/data/repositories/teacher-repo.ts \
        src/lib/data/repositories/achievement-repo.ts \
        src/lib/data/repositories/extracurricular-repo.ts \
        src/__tests__/integration/repositories/entity-repos.test.ts
git commit -m "feat(data): repositories for Teacher, Achievement, Extracurricular"
```

---

### Task 9: Repositories — Subject, Faq, GalleryItem, Facility, OrganizationMember, DocumentSlot

**Why:** Remaining 6 repos. Each one is similar to teacher/achievement pattern (findMany + map + cache tag). Group into one task to avoid 6 separate review cycles.

**Files:**
- Create: `src/lib/data/repositories/subject-repo.ts`
- Create: `src/lib/data/repositories/faq-repo.ts`
- Create: `src/lib/data/repositories/gallery-repo.ts`
- Create: `src/lib/data/repositories/facility-repo.ts`
- Create: `src/lib/data/repositories/organization-repo.ts`
- Create: `src/lib/data/repositories/document-slot-repo.ts`
- Create: `src/__tests__/integration/repositories/remaining-repos.test.ts`

- [ ] **Step 9.1: Write failing integration test (one test file covers all 6)**

Create `src/__tests__/integration/repositories/remaining-repos.test.ts`:
```ts
import { prisma } from '@/lib/db/client';
import { getSubjectGroupsByGrade } from '@/lib/data/repositories/subject-repo';
import { getFaqs } from '@/lib/data/repositories/faq-repo';
import { getAllGalleryItems } from '@/lib/data/repositories/gallery-repo';
import { getFacilitiesGrouped } from '@/lib/data/repositories/facility-repo';
import { getOrganizationChart } from '@/lib/data/repositories/organization-repo';
import { getDocumentSlot } from '@/lib/data/repositories/document-slot-repo';

describe('remaining entity repositories', () => {
  beforeAll(async () => {
    await prisma.subject.deleteMany({});
    await prisma.faq.deleteMany({});
    await prisma.galleryItem.deleteMany({});
    await prisma.facility.deleteMany({});
    await prisma.organizationMember.deleteMany({});
    await prisma.documentSlot.deleteMany({});

    await prisma.subject.createMany({
      data: [
        { id: 's1', grade: 7, groupId: 'a', groupTitle: 'Kelompok A',
          name: 'Matematika', icon: '📐', iconBg: '#fff', hours: '5', order: 0 },
        { id: 's2', grade: 7, groupId: 'a', groupTitle: 'Kelompok A',
          name: 'IPA', icon: '🔬', iconBg: '#fff', hours: '5', order: 1 },
        { id: 's3', grade: 8, groupId: 'a', groupTitle: 'Kelompok A',
          name: 'Matematika', icon: '📐', iconBg: '#fff', hours: '5', order: 0 },
      ],
    });
    await prisma.faq.create({
      data: { id: 'q1', question: 'Q', answer: 'A', category: 'ppdb', order: 0 },
    });
    await prisma.galleryItem.create({
      data: { id: 'g1', caption: 'C', emoji: '📚', gradientFrom: '#000', gradientTo: '#fff', order: 0 },
    });
    await prisma.facility.createMany({
      data: [
        { id: 'f1', kind: 'featured', name: 'Lab', description: 'd', emoji: '🔬',
          gradientFrom: '#000', gradientTo: '#fff', order: 0 },
        { id: 'f2', kind: 'mini', name: 'Kantin', icon: '🍽️', order: 0 },
      ],
    });
    await prisma.organizationMember.createMany({
      data: [
        { id: 'om1', name: 'Pak X', role: 'Kepsek', level: 0, order: 0 },
        { id: 'om2', name: 'Bu Y', role: 'Wakasek', level: 1, parentId: 'om1', order: 0 },
      ],
    });
    await prisma.documentSlot.create({ data: { id: 'kalender-akademik' } });
  });

  afterAll(async () => {
    await prisma.subject.deleteMany({});
    await prisma.faq.deleteMany({});
    await prisma.galleryItem.deleteMany({});
    await prisma.facility.deleteMany({});
    await prisma.organizationMember.deleteMany({});
    await prisma.documentSlot.deleteMany({});
    await prisma.$disconnect();
  });

  it('getSubjectGroupsByGrade returns subjects grouped by grade → groupId', async () => {
    const groups = await getSubjectGroupsByGrade(7);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.id).toBe('a');
    expect(groups[0]?.subjects).toHaveLength(2);
    expect(groups[0]?.subjects[0]?.name).toBe('Matematika');
  });

  it('getFaqs returns array', async () => {
    const faqs = await getFaqs();
    expect(faqs).toHaveLength(1);
    expect(faqs[0]?.category).toBe('ppdb');
  });

  it('getAllGalleryItems returns array', async () => {
    const items = await getAllGalleryItems();
    expect(items).toHaveLength(1);
  });

  it('getFacilitiesGrouped returns { featured: [...], mini: [...] }', async () => {
    const grouped = await getFacilitiesGrouped();
    expect(grouped.featured).toHaveLength(1);
    expect(grouped.mini).toHaveLength(1);
    expect(grouped.featured[0]?.emoji).toBe('🔬');
  });

  it('getOrganizationChart returns levels grouped by level number', async () => {
    const chart = await getOrganizationChart();
    expect(chart).toHaveLength(2);
    expect(chart[0]?.boxes[0]?.name).toBe('Pak X');
    expect(chart[1]?.boxes[0]?.name).toBe('Bu Y');
  });

  it('getDocumentSlot returns full shape with mediaId=null when no upload', async () => {
    const slot = await getDocumentSlot('kalender-akademik');
    expect(slot).toEqual({ id: 'kalender-akademik', mediaId: null });
  });

  it('getDocumentSlot returns null for unknown slot id', async () => {
    const slot = await getDocumentSlot('nonexistent');
    expect(slot).toBeNull();
  });
});
```

- [ ] **Step 9.2: Run, expect FAIL**

Run: `npm run test:int -- --testPathPattern='repositories/remaining-repos'`
Expected: FAIL.

- [ ] **Step 9.3: Implement subject-repo**

Create `src/lib/data/repositories/subject-repo.ts`:
```ts
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/db/client';
import type { SubjectGroup } from '@config/types';

async function loadSubjectGroupsByGrade(grade: number): Promise<SubjectGroup[]> {
  const rows = await prisma.subject.findMany({
    where: { grade },
    orderBy: [{ groupId: 'asc' }, { order: 'asc' }],
  });
  const byGroup = new Map<string, SubjectGroup>();
  for (const r of rows) {
    let group = byGroup.get(r.groupId);
    if (!group) {
      group = { id: r.groupId, title: r.groupTitle, subjects: [] };
      byGroup.set(r.groupId, group);
    }
    group.subjects.push({
      id: r.id, name: r.name, icon: r.icon, iconBg: r.iconBg, hours: r.hours,
    });
  }
  return Array.from(byGroup.values());
}

export function getSubjectGroupsByGrade(grade: number): Promise<SubjectGroup[]> {
  const cached = unstable_cache(
    () => loadSubjectGroupsByGrade(grade),
    ['subjects', `grade-${grade}`],
    { tags: ['subjects'] },
  );
  return cached();
}
```

- [ ] **Step 9.4: Implement faq-repo**

Create `src/lib/data/repositories/faq-repo.ts`:
```ts
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/db/client';
import type { Faq } from '@config/types';

async function loadFaqs(): Promise<Faq[]> {
  const rows = await prisma.faq.findMany({ orderBy: [{ category: 'asc' }, { order: 'asc' }] });
  return rows.map((r) => ({
    id: r.id, question: r.question, answer: r.answer,
    category: r.category as Faq['category'],
  }));
}

export const getFaqs = unstable_cache(loadFaqs, ['faqs'], { tags: ['faqs'] });
```

- [ ] **Step 9.5: Implement gallery-repo**

Create `src/lib/data/repositories/gallery-repo.ts`:
```ts
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/db/client';
import type { GalleryItem } from '@config/types';

function rowToGalleryItem(r: {
  id: string; caption: string; emoji: string; gradientFrom: string; gradientTo: string;
  category: string | null; span: string | null;
}): GalleryItem {
  const item: GalleryItem = {
    id: r.id, caption: r.caption, emoji: r.emoji,
    gradientFrom: r.gradientFrom, gradientTo: r.gradientTo,
  };
  if (r.category) item.category = r.category;
  if (r.span) item.span = r.span as GalleryItem['span'];
  return item;
}

async function loadAllGalleryItems(): Promise<GalleryItem[]> {
  const rows = await prisma.galleryItem.findMany({ orderBy: [{ order: 'asc' }] });
  return rows.map(rowToGalleryItem);
}

/**
 * All gallery items. Used by /fasilitas galeri page with filter UI.
 */
export const getAllGalleryItems = unstable_cache(loadAllGalleryItems, ['gallery', 'all'], {
  tags: ['gallery'],
});

/**
 * Subset by ID list, preserving caller order. Used by /home gallery whose
 * featured-8 IDs are stored in PageSection.galleryMeta.featuredIds.
 */
export function getGalleryItemsByIds(ids: readonly string[]): Promise<GalleryItem[]> {
  const cached = unstable_cache(
    async () => {
      const rows = await prisma.galleryItem.findMany({ where: { id: { in: [...ids] } } });
      const byId = new Map(rows.map((r) => [r.id, rowToGalleryItem(r)]));
      return ids.map((id) => byId.get(id)).filter((x): x is GalleryItem => x !== undefined);
    },
    ['gallery', 'by-ids', ids.join(',')],
    { tags: ['gallery'] },
  );
  return cached();
}
```

- [ ] **Step 9.6: Implement facility-repo**

Create `src/lib/data/repositories/facility-repo.ts`:
```ts
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/db/client';
import type { FacilityCard, FacilityMini } from '@config/types';

export type FacilitiesGrouped = { featured: FacilityCard[]; mini: FacilityMini[] };

async function loadFacilitiesGrouped(): Promise<FacilitiesGrouped> {
  const rows = await prisma.facility.findMany({ orderBy: [{ kind: 'asc' }, { order: 'asc' }] });
  const featured: FacilityCard[] = [];
  const mini: FacilityMini[] = [];
  for (const r of rows) {
    if (r.kind === 'featured') {
      if (r.description === null || r.emoji === null || r.gradientFrom === null || r.gradientTo === null) {
        throw new Error(`Facility ${r.id}: kind=featured requires description + emoji + gradientFrom + gradientTo`);
      }
      const card: FacilityCard = {
        id: r.id, name: r.name, description: r.description,
        emoji: r.emoji, gradientFrom: r.gradientFrom, gradientTo: r.gradientTo,
      };
      if (r.span) card.span = r.span as FacilityCard['span'];
      featured.push(card);
    } else if (r.kind === 'mini') {
      if (r.icon === null) {
        throw new Error(`Facility ${r.id}: kind=mini requires icon`);
      }
      mini.push({ id: r.id, name: r.name, icon: r.icon });
    } else {
      throw new Error(`Facility ${r.id}: unknown kind "${r.kind}"`);
    }
  }
  return { featured, mini };
}

export const getFacilitiesGrouped = unstable_cache(
  loadFacilitiesGrouped, ['facilities'], { tags: ['facilities'] },
);
```

- [ ] **Step 9.7: Implement organization-repo**

Create `src/lib/data/repositories/organization-repo.ts`:
```ts
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/db/client';
import type { OrgChartLevel } from '@config/types';

async function loadOrganizationChart(): Promise<OrgChartLevel[]> {
  const rows = await prisma.organizationMember.findMany({
    orderBy: [{ level: 'asc' }, { order: 'asc' }],
  });
  const byLevel = new Map<number, OrgChartLevel>();
  for (const r of rows) {
    let lvl = byLevel.get(r.level);
    if (!lvl) {
      lvl = { id: `level-${r.level}`, boxes: [] };
      byLevel.set(r.level, lvl);
    }
    lvl.boxes.push({ name: r.name, title: r.role });
  }
  return Array.from(byLevel.values());
}

export const getOrganizationChart = unstable_cache(
  loadOrganizationChart, ['organization'], { tags: ['organization'] },
);
```

- [ ] **Step 9.8: Implement document-slot-repo**

Create `src/lib/data/repositories/document-slot-repo.ts`:
```ts
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/db/client';

export type DocumentSlotData = { id: string; mediaId: string | null };

async function loadDocumentSlot(id: string): Promise<DocumentSlotData | null> {
  const row = await prisma.documentSlot.findUnique({ where: { id } });
  if (!row) return null;
  return { id: row.id, mediaId: row.mediaId };
}

export function getDocumentSlot(id: string): Promise<DocumentSlotData | null> {
  const cached = unstable_cache(
    () => loadDocumentSlot(id),
    ['document-slot', id],
    { tags: ['documents'] },
  );
  return cached();
}
```

- [ ] **Step 9.9: Run integration test, expect PASS**

Run: `npm run test:int -- --testPathPattern='repositories/remaining-repos'`
Expected: 7 tests pass.

- [ ] **Step 9.10: Commit**

```bash
git add src/lib/data/repositories/subject-repo.ts \
        src/lib/data/repositories/faq-repo.ts \
        src/lib/data/repositories/gallery-repo.ts \
        src/lib/data/repositories/facility-repo.ts \
        src/lib/data/repositories/organization-repo.ts \
        src/lib/data/repositories/document-slot-repo.ts \
        src/__tests__/integration/repositories/remaining-repos.test.ts
git commit -m "feat(data): repositories for Subject, Faq, Gallery, Facility, Organization, DocumentSlot"
```

---

## Chunk 3: Seed + assemblers + ApiContentProvider

### Task 10: Idempotent content seed from existing config

**Why:** Bootstrap DB from `src/config/`. Idempotent so we can re-run safely. This is the "data migration" — after seed, DB has same content as static files.

**Files:**
- Create: `scripts/seed-content.ts`
- Create: `src/__tests__/integration/seed-content.test.ts`

- [ ] **Step 10.1: Implement seed script**

Create `scripts/seed-content.ts`:
```ts
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

// Maps TeacherCategory → display order (pimpinan first).
const TEACHER_CATEGORY_ORDER: Record<string, number> = { pimpinan: 0, guru: 1, tu: 2 };
// Maps EkskulCategory → display order (matches static config sequence).
const EKSKUL_CATEGORY_ORDER: Record<string, number> = {
  wajib: 0, olahraga: 1, seni: 2, akademik: 3, keagamaan: 4, lainnya: 5,
};

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
  // Phase 1: ppdbCta → kontakCta
  const { ppdbCta: _ppdb, navigation: _navFromSite, ...siteRest } = rawSite as typeof rawSite & {
    ppdbCta?: unknown;
  };
  void _ppdb;
  void _navFromSite;
  const siteData = {
    ...siteRest,
    kontakCta: { label: 'Kontak', href: '/kontak' },
  };
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
    kalenderMeta: { meta: akademikPageConfig.kalender.meta, events: akademikPageConfig.kalender.events, downloadLabel: akademikPageConfig.kalender.downloadLabel, downloadHref: akademikPageConfig.kalender.downloadHref },
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
    tatib: fasilitasPageConfig.tatib,
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
    const catOrder = TEACHER_CATEGORY_ORDER[cat] ?? 99;
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
    const catOrder = EKSKUL_CATEGORY_ORDER[cat] ?? 99;
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

  console.log('==> Seed: Subjects');
  for (const tab of akademikPageConfig.mapel.tabs) {
    const grade = tab.id === 'kelas7' ? 7 : tab.id === 'kelas8' ? 8 : 9;
    let order = 0;
    for (const group of tab.groups) {
      for (const s of group.subjects) {
        const o = order++; // capture before next iteration so update uses same value
        await prisma.subject.upsert({
          where: { id: s.id },
          create: {
            id: s.id, grade, groupId: group.id, groupTitle: group.title,
            name: s.name, icon: s.icon, iconBg: s.iconBg, hours: s.hours, order: o,
          },
          update: {
            grade, groupId: group.id, groupTitle: group.title,
            name: s.name, icon: s.icon, iconBg: s.iconBg, hours: s.hours, order: o,
          },
        });
      }
    }
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
    await prisma.galleryItem.upsert({
      where: { id: g.id },
      create: {
        id: g.id, caption: g.caption, emoji: g.emoji,
        gradientFrom: g.gradientFrom, gradientTo: g.gradientTo,
        category: g.category ?? null, span: g.span ?? null, order,
      },
      update: {
        caption: g.caption, emoji: g.emoji,
        gradientFrom: g.gradientFrom, gradientTo: g.gradientTo,
        category: g.category ?? null, span: g.span ?? null, order,
      },
    });
  }

  console.log('==> Seed: Facilities');
  for (let i = 0; i < fasilitasPageConfig.sarana.featured.length; i++) {
    const f = fasilitasPageConfig.sarana.featured[i]!;
    const order = i;
    await prisma.facility.upsert({
      where: { id: f.id },
      create: {
        id: f.id, kind: 'featured', name: f.name, description: f.description,
        emoji: f.emoji, gradientFrom: f.gradientFrom, gradientTo: f.gradientTo,
        span: f.span ?? null, icon: null, order,
      },
      update: {
        kind: 'featured', name: f.name, description: f.description,
        emoji: f.emoji, gradientFrom: f.gradientFrom, gradientTo: f.gradientTo,
        span: f.span ?? null, icon: null, order,
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
        description: null, emoji: null, gradientFrom: null, gradientTo: null, span: null,
        order,
      },
      update: {
        kind: 'mini', name: m.name, icon: m.icon,
        description: null, emoji: null, gradientFrom: null, gradientTo: null, span: null,
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
```

- [ ] **Step 10.2: Add script to package.json**

In `package.json` `scripts`, add:
```json
"db:seed:content": "tsx scripts/seed-content.ts"
```

- [ ] **Step 10.3: Run seed against test DB (idempotency check)**

Run twice:
```bash
DATABASE_URL="postgresql://test:test@localhost:5433/smpn3_test?schema=public" npm run db:seed:content
DATABASE_URL="postgresql://test:test@localhost:5433/smpn3_test?schema=public" npm run db:seed:content
```

Expected: both runs succeed. Second run does updates (no errors, no duplicates).

Verify row counts:
```bash
DATABASE_URL="postgresql://test:test@localhost:5433/smpn3_test?schema=public" npx tsx -e "
import { prisma } from './src/lib/db/client';
const counts = await Promise.all([
  prisma.siteConfig.count(),
  prisma.navigation.count(),
  prisma.pageSection.count(),
  prisma.teacher.count(),
  prisma.achievement.count(),
  prisma.extracurricular.count(),
  prisma.subject.count(),
  prisma.faq.count(),
  prisma.galleryItem.count(),
  prisma.facility.count(),
  prisma.organizationMember.count(),
  prisma.documentSlot.count(),
]);
console.log('Counts:', { siteConfig: counts[0], navigation: counts[1], pageSection: counts[2], teacher: counts[3], achievement: counts[4], ekskul: counts[5], subject: counts[6], faq: counts[7], gallery: counts[8], facility: counts[9], orgMember: counts[10], docSlot: counts[11] });
await prisma.\$disconnect();
"
```

Expected: each count > 0 (or = 1 for singletons). Same counts on both runs (no growth from second seed).

- [ ] **Step 10.4: Write integration test asserting seed populates correctly**

Create `src/__tests__/integration/seed-content.test.ts`:
```ts
import { execSync } from 'node:child_process';
import { prisma } from '@/lib/db/client';

describe('seed-content script', () => {
  beforeAll(async () => {
    // Clean entire content schema before testing seed.
    await prisma.pageSection.deleteMany({});
    await prisma.siteConfig.deleteMany({});
    await prisma.navigation.deleteMany({});
    await prisma.teacher.deleteMany({});
    await prisma.achievement.deleteMany({});
    await prisma.extracurricular.deleteMany({});
    await prisma.subject.deleteMany({});
    await prisma.faq.deleteMany({});
    await prisma.galleryItem.deleteMany({});
    await prisma.facility.deleteMany({});
    await prisma.organizationMember.deleteMany({});
    await prisma.documentSlot.deleteMany({});
  }, 30_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('populates all content tables idempotently', async () => {
    // Run twice
    const cmd = 'DATABASE_URL="postgresql://test:test@localhost:5433/smpn3_test?schema=public" npx tsx scripts/seed-content.ts';
    execSync(cmd, { stdio: 'pipe', shell: '/bin/bash' });
    const firstCounts = {
      site: await prisma.siteConfig.count(),
      nav: await prisma.navigation.count(),
      sections: await prisma.pageSection.count(),
      teachers: await prisma.teacher.count(),
      faqs: await prisma.faq.count(),
    };

    execSync(cmd, { stdio: 'pipe', shell: '/bin/bash' });
    const secondCounts = {
      site: await prisma.siteConfig.count(),
      nav: await prisma.navigation.count(),
      sections: await prisma.pageSection.count(),
      teachers: await prisma.teacher.count(),
      faqs: await prisma.faq.count(),
    };

    expect(firstCounts).toEqual(secondCounts);
    expect(firstCounts.site).toBe(1);
    expect(firstCounts.nav).toBe(1);
    expect(firstCounts.sections).toBeGreaterThan(20);  // at least ~30 page sections total
    expect(firstCounts.teachers).toBeGreaterThan(0);
    expect(firstCounts.faqs).toBeGreaterThan(0);
  }, 60_000);
});
```

- [ ] **Step 10.5: Run integration test**

Run: `npm run test:int -- --testPathPattern='seed-content'`
Expected: 1 test pass (~5-10s).

- [ ] **Step 10.6: Commit**

```bash
git add scripts/seed-content.ts package.json src/__tests__/integration/seed-content.test.ts
git commit -m "feat(db): idempotent content seed from static config"
```

---

### Task 11: Assemblers — compose page configs from repos

**Why:** Each public page calls `getContentProvider().getHomePage()` (etc.) and expects a full `HomePageConfig`. We compose this from `pageSectionRepo` + entity repos. One assembler file per page.

**Files:**
- Create: `src/lib/data/assemblers/home.ts`
- Create: `src/lib/data/assemblers/profil.ts`
- Create: `src/lib/data/assemblers/akademik.ts`
- Create: `src/lib/data/assemblers/fasilitas.ts`
- Create: `src/lib/data/assemblers/kontak.ts`
- Create: `src/__tests__/integration/assemblers/assemblers.test.ts`

- [ ] **Step 11.1: Write failing integration test**

Create `src/__tests__/integration/assemblers/assemblers.test.ts`:
```ts
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
```

- [ ] **Step 11.2: Run, expect FAIL**

Run: `npm run test:int -- --testPathPattern='assemblers/assemblers'`
Expected: FAIL — modules not found.

- [ ] **Step 11.3: Implement home assembler**

Create `src/lib/data/assemblers/home.ts`:
```ts
// Phase 1: types cast on JSONB sections are unchecked at runtime. Seed is the
// only writer in Phase 1 (Zod-validated). Phase 2 will add Zod-on-write so this
// remains safe; if Phase 2's admin UI ever stores invalid shapes, this assembler
// will surface them via render errors rather than silent data corruption.
import { getPageSections } from '../repositories/page-section-repo';
import { getAchievementsByIds } from '../repositories/achievement-repo';
import { getGalleryItemsByIds } from '../repositories/gallery-repo';
import type {
  HomePageConfig, HeroConfig, SambutanConfig, AboutConfig,
  CtaFinal, SectionMeta, StatCard, ProgramCard, ContactCard, CtaLink,
} from '@config/types';

// Shape stored in DB for sections that wrap "meta + cta + featuredIds".
type GalleryMetaSection = {
  meta: SectionMeta; ctaLabel: string; ctaHref: string; featuredIds: string[];
};
type AchievementsMetaSection = {
  meta: SectionMeta; ctaLabel: string; ctaHref: string; featuredIds: string[];
};
type LokasiSection = {
  meta: SectionMeta; panelTitle: string; panelDescription: string;
  cards: ContactCard[]; primary: CtaLink; secondary: CtaLink; copyText: string;
};
type StatsSection = { meta: SectionMeta; cards: StatCard[] };
type ProgramsSection = { meta: SectionMeta; cards: ProgramCard[] };

export async function assembleHome(): Promise<HomePageConfig> {
  const sections = await getPageSections('home');

  const hero = sections.hero as HeroConfig;
  const stats = sections.stats as StatsSection;
  const sambutan = sections.sambutan as SambutanConfig;
  const about = sections.about as AboutConfig;
  const programs = sections.programs as ProgramsSection;
  const galleryMeta = sections.galleryMeta as GalleryMetaSection;
  const achievementsMeta = sections.achievementsMeta as AchievementsMetaSection;
  const lokasi = sections.lokasi as LokasiSection;
  const ctaFinal = sections.ctaFinal as CtaFinal;

  // Scoped fetch: home only shows the IDs explicitly featured for home.
  // This prevents "all 11 achievements" / "all 18 gallery items" bug.
  const [achievements, gallery] = await Promise.all([
    getAchievementsByIds(achievementsMeta.featuredIds),
    getGalleryItemsByIds(galleryMeta.featuredIds),
  ]);

  return {
    hero,
    stats,
    sambutan,
    about,
    programs,
    gallery: {
      meta: galleryMeta.meta,
      items: gallery,
      ctaLabel: galleryMeta.ctaLabel,
      ctaHref: galleryMeta.ctaHref,
    },
    achievements: {
      meta: achievementsMeta.meta,
      items: achievements,
      ctaLabel: achievementsMeta.ctaLabel,
      ctaHref: achievementsMeta.ctaHref,
    },
    lokasi,
    ctaFinal,
  };
}
```

- [ ] **Step 11.4: Implement profil assembler**

Create `src/lib/data/assemblers/profil.ts`:
```ts
// See header note in assemblers/home.ts about Phase 1 type-cast safety.
import { getPageSections } from '../repositories/page-section-repo';
import { getTeachers } from '../repositories/teacher-repo';
import { getAchievementsByIds } from '../repositories/achievement-repo';
import { getOrganizationChart } from '../repositories/organization-repo';
import type {
  ProfilePageConfig, PageHeaderConfig, VisiMisiConfig,
  ObjectiveCard, IdentityRow, CtaFinal, SectionMeta,
} from '@config/types';

type SejarahSection = ProfilePageConfig['sejarah'];
type StrukturMetaSection = { meta: SectionMeta; studentNote: string };
type GuruMetaSection = { meta: SectionMeta; filterLabels: ProfilePageConfig['guru']['filterLabels'] };
type PrestasiMetaSection = { meta: SectionMeta; featuredIds: string[] };

export async function assembleProfile(): Promise<ProfilePageConfig> {
  const sections = await getPageSections('profil');

  const pageHeader = sections.pageHeader as PageHeaderConfig;
  const sejarah = sections.sejarah as SejarahSection;
  const visiMisi = sections.visiMisi as VisiMisiConfig;
  const tujuan = sections.tujuan as { meta: SectionMeta; cards: ObjectiveCard[] };
  const identitas = sections.identitas as { meta: SectionMeta; rows: IdentityRow[] };
  const strukturMeta = sections.strukturMeta as StrukturMetaSection;
  const guruMeta = sections.guruMeta as GuruMetaSection;
  const prestasiMeta = sections.prestasiMeta as PrestasiMetaSection;
  const ctaFinal = sections.ctaFinal as CtaFinal;

  // Fetch entities only after we have the IDs needed.
  const [teachers, achievements, chartLevels] = await Promise.all([
    getTeachers(),
    getAchievementsByIds(prestasiMeta.featuredIds),
    getOrganizationChart(),
  ]);

  return {
    pageHeader,
    sejarah,
    visiMisi,
    tujuan,
    identitas,
    struktur: {
      meta: strukturMeta.meta,
      chart: { levels: chartLevels, studentNote: strukturMeta.studentNote },
    },
    guru: {
      meta: guruMeta.meta,
      filterLabels: guruMeta.filterLabels,
      teachers,
    },
    prestasi: { meta: prestasiMeta.meta, items: achievements },
    ctaFinal,
  };
}
```

- [ ] **Step 11.5: Implement akademik assembler**

Create `src/lib/data/assemblers/akademik.ts`:
```ts
import { getPageSections } from '../repositories/page-section-repo';
import { getSubjectGroupsByGrade } from '../repositories/subject-repo';
import type {
  AcademicPageConfig, PageHeaderConfig, KurikulumConfig,
  ScheduleCard, MethodCard, AssessmentCard, CalendarEvent,
  CtaFinal, SectionMeta,
} from '@config/types';

type MapelMetaSection = { meta: SectionMeta };
type JadwalSection = { meta: SectionMeta; cards: ScheduleCard[]; note: string };
type MetodeSection = { meta: SectionMeta; cards: MethodCard[] };
type PenilaianSection = { meta: SectionMeta; intro: string; cards: AssessmentCard[] };
type KalenderMetaSection = {
  meta: SectionMeta; events: CalendarEvent[];
  downloadLabel: string; downloadHref: string;
};

export async function assembleAcademic(): Promise<AcademicPageConfig> {
  const [sections, g7, g8, g9] = await Promise.all([
    getPageSections('akademik'),
    getSubjectGroupsByGrade(7),
    getSubjectGroupsByGrade(8),
    getSubjectGroupsByGrade(9),
  ]);

  const pageHeader = sections.pageHeader as PageHeaderConfig;
  const kurikulum = sections.kurikulum as KurikulumConfig;
  const mapelMeta = sections.mapelMeta as MapelMetaSection;
  const jadwal = sections.jadwal as JadwalSection;
  const metode = sections.metode as MetodeSection;
  const penilaian = sections.penilaian as PenilaianSection;
  const kalenderMeta = sections.kalenderMeta as KalenderMetaSection;
  const ctaFinal = sections.ctaFinal as CtaFinal;

  return {
    pageHeader,
    kurikulum,
    mapel: {
      meta: mapelMeta.meta,
      tabs: [
        { id: 'kelas7', label: 'Kelas 7', groups: g7 },
        { id: 'kelas8', label: 'Kelas 8', groups: g8 },
        { id: 'kelas9', label: 'Kelas 9', groups: g9 },
      ],
    },
    jadwal,
    metode,
    penilaian,
    kalender: {
      meta: kalenderMeta.meta,
      events: kalenderMeta.events,
      downloadLabel: kalenderMeta.downloadLabel,
      downloadHref: kalenderMeta.downloadHref,
    },
    ctaFinal,
  };
}
```

- [ ] **Step 11.6: Implement fasilitas assembler**

Create `src/lib/data/assemblers/fasilitas.ts`:
```ts
// See header note in assemblers/home.ts about Phase 1 type-cast safety.
import { getPageSections } from '../repositories/page-section-repo';
import { getExtracurriculars } from '../repositories/extracurricular-repo';
import { getGalleryItemsByIds } from '../repositories/gallery-repo';
import { getFacilitiesGrouped } from '../repositories/facility-repo';
import type {
  FacilitiesPageConfig, PageHeaderConfig, KegiatanCard,
  AccordionContent, CtaFinal, SectionMeta,
} from '@config/types';

type SaranaMetaSection = { meta: SectionMeta; statStrip: { value: string; label: string }[] };
type EkskulMetaSection = {
  meta: SectionMeta;
  statStrip: { value: string; label: string }[];
  filterLabels: FacilitiesPageConfig['ekskul']['filterLabels'];
};
type KegiatanSection = { meta: SectionMeta; cards: KegiatanCard[] };
type GaleriMetaSection = {
  meta: SectionMeta;
  filterLabels: FacilitiesPageConfig['galeri']['filterLabels'];
  featuredIds: string[];
};
type TatibSection = {
  meta: SectionMeta;
  accordions: AccordionContent[];
  downloadLabel: string;
  downloadHref: string;
};

export async function assembleFacilities(): Promise<FacilitiesPageConfig> {
  const sections = await getPageSections('fasilitas');

  const pageHeader = sections.pageHeader as PageHeaderConfig;
  const saranaMeta = sections.saranaMeta as SaranaMetaSection;
  const ekskulMeta = sections.ekskulMeta as EkskulMetaSection;
  const kegiatan = sections.kegiatan as KegiatanSection;
  const galeriMeta = sections.galeriMeta as GaleriMetaSection;
  const tatib = sections.tatib as TatibSection;
  const ctaFinal = sections.ctaFinal as CtaFinal;

  const [ekskul, gallery, fac] = await Promise.all([
    getExtracurriculars(),
    getGalleryItemsByIds(galeriMeta.featuredIds),
    getFacilitiesGrouped(),
  ]);

  return {
    pageHeader,
    sarana: {
      meta: saranaMeta.meta,
      statStrip: saranaMeta.statStrip,
      featured: fac.featured,
      mini: fac.mini,
    },
    ekskul: {
      meta: ekskulMeta.meta,
      statStrip: ekskulMeta.statStrip,
      filterLabels: ekskulMeta.filterLabels,
      items: ekskul,
    },
    kegiatan,
    galeri: {
      meta: galeriMeta.meta,
      filterLabels: galeriMeta.filterLabels,
      items: gallery,
    },
    tatib,
    ctaFinal,
  };
}
```

- [ ] **Step 11.7: Implement kontak assembler**

Create `src/lib/data/assemblers/kontak.ts`:
```ts
import { getPageSections } from '../repositories/page-section-repo';
import { getFaqs } from '../repositories/faq-repo';
import type {
  ContactPageConfig, PageHeaderConfig, ContactFormConfig,
  CtaFinal, SectionMeta, ContactCard, CtaLink,
} from '@config/types';

type KontakInfoSection = {
  meta: SectionMeta; cards: ContactCard[];
  socialHeading: string; socialSub: string;
};
type PetaSection = {
  meta: SectionMeta; placeholderText: string;
  primaryAction: CtaLink; secondaryAction: CtaLink;
};
type FaqMetaSection = {
  meta: SectionMeta; searchPlaceholder: string;
  filterLabels: ContactPageConfig['faq']['filterLabels'];
  noResultsText: string; ctaText: string; ctaHref: string;
};

export async function assembleContact(): Promise<ContactPageConfig> {
  const [sections, faqs] = await Promise.all([
    getPageSections('kontak'),
    getFaqs(),
  ]);

  const pageHeader = sections.pageHeader as PageHeaderConfig;
  const kontakInfo = sections.kontakInfo as KontakInfoSection;
  const peta = sections.peta as PetaSection;
  const form = sections.form as ContactFormConfig;
  const faqMeta = sections.faqMeta as FaqMetaSection;
  const ctaFinal = sections.ctaFinal as CtaFinal;

  return {
    pageHeader,
    kontakInfo,
    peta,
    form,
    faq: {
      meta: faqMeta.meta,
      searchPlaceholder: faqMeta.searchPlaceholder,
      filterLabels: faqMeta.filterLabels,
      items: faqs,
      noResultsText: faqMeta.noResultsText,
      ctaText: faqMeta.ctaText,
      ctaHref: faqMeta.ctaHref,
    },
    ctaFinal,
  };
}
```

- [ ] **Step 11.8: Run integration test, expect PASS**

Run: `npm run test:int -- --testPathPattern='assemblers/assemblers'`
Expected: 5 tests pass.

- [ ] **Step 11.9: Commit**

```bash
git add src/lib/data/assemblers/ src/__tests__/integration/assemblers/
git commit -m "feat(data): page assemblers (home, profil, akademik, fasilitas, kontak)"
```

---

### Task 12: ApiContentProvider — Prisma implementation

**Why:** Replace the stub `ApiContentProvider` with a real implementation that delegates to assemblers + site-repo. This is the entry point swap that makes `NEXT_PUBLIC_DATA_SOURCE=api` work.

**Files:**
- Modify: `src/lib/data/ApiContentProvider.ts`
- Create: `src/__tests__/integration/data/api-content-provider.test.ts`

- [ ] **Step 12.1: Write failing test**

Create `src/__tests__/integration/data/api-content-provider.test.ts`:
```ts
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
```

- [ ] **Step 12.2: Run, expect FAIL**

Run: `npm run test:int -- --testPathPattern='api-content-provider'`
Expected: FAIL — `ApiContentProvider.getSiteConfig is not implemented yet`.

- [ ] **Step 12.3: Replace ApiContentProvider**

Replace `src/lib/data/ApiContentProvider.ts`:
```ts
import type { ContentProvider } from './ContentProvider';
import { getSiteConfig } from './repositories/site-repo';
import { assembleHome } from './assemblers/home';
import { assembleProfile } from './assemblers/profil';
import { assembleAcademic } from './assemblers/akademik';
import { assembleFacilities } from './assemblers/fasilitas';
import { assembleContact } from './assemblers/kontak';

/**
 * Phase 1: reads all content from Postgres via Prisma.
 * Activated by setting NEXT_PUBLIC_DATA_SOURCE=api in env.
 */
export class ApiContentProvider implements ContentProvider {
  getSiteConfig() { return getSiteConfig(); }
  getHomePage() { return assembleHome(); }
  getProfilePage() { return assembleProfile(); }
  getAcademicPage() { return assembleAcademic(); }
  getFacilitiesPage() { return assembleFacilities(); }
  getContactPage() { return assembleContact(); }
}
```

- [ ] **Step 12.4: Update factory + downstream test**

Inspect `src/lib/data/index.ts`. Existing factory:
```ts
new ApiContentProvider(process.env.NEXT_PUBLIC_API_BASE_URL ?? '')
```

The new ApiContentProvider constructor takes no args. Update the factory:
```bash
sed -i.bak "s|new ApiContentProvider(process.env.NEXT_PUBLIC_API_BASE_URL ?? '')|new ApiContentProvider()|" src/lib/data/index.ts && rm src/lib/data/index.ts.bak
```

Verify: `grep -n "ApiContentProvider" src/lib/data/index.ts` should show plain construction.

**Also update the existing unit test** at `src/__tests__/lib/data/getContentProvider.test.ts` if it constructs `ApiContentProvider` with a baseUrl argument. Find the spot (look for `new ApiContentProvider(...)`) and remove the argument. Run:

```bash
grep -n "new ApiContentProvider" src/__tests__/lib/data/getContentProvider.test.ts
```

If matches found, edit by hand (don't sed — context-sensitive). Replace `new ApiContentProvider('...')` with `new ApiContentProvider()`. Then run `npm test -- --testPathPattern='getContentProvider'` to confirm it passes.

**Decide on `NEXT_PUBLIC_API_BASE_URL` env var**: it's now dead config (no consumer). Two options:
- **Recommended**: remove from `src/lib/env.ts` (client block) AND from `.env.example`. Future Phase 3 (Cloudinary) doesn't need this — it has its own env vars.
- **Defer**: keep it for now; remove during Phase 1 cleanup or Phase 3 housekeeping.

For Phase 1, **remove it** to keep env.ts clean. Edit `src/lib/env.ts`: drop the `NEXT_PUBLIC_API_BASE_URL` line from both `client` and `runtimeEnv` blocks. Edit `.env.example`: remove the `NEXT_PUBLIC_API_BASE_URL=` line and surrounding comment.

Verify: `npm run typecheck` clean after edit.

- [ ] **Step 12.5: Run integration test, expect PASS**

Run: `npm run test:int -- --testPathPattern='api-content-provider'`
Expected: 6 tests pass.

- [ ] **Step 12.6: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 12.7: Commit**

```bash
git add src/lib/data/ApiContentProvider.ts src/lib/data/index.ts \
        src/lib/env.ts .env.example \
        src/__tests__/lib/data/getContentProvider.test.ts \
        src/__tests__/integration/data/api-content-provider.test.ts
git commit -m "feat(data): ApiContentProvider full Prisma implementation"
```

---

## Chunk 4: Switch + verify + ship

### Task 13: Flip data source to api + verify visual parity

**Why:** This is the moment of truth. Flip env to `api`, run full visual regression, confirm site renders identically.

**Files:**
- Modify: `.env.local` (local switch)
- Modify: `playwright.config.ts` (E2E uses api now)

- [ ] **Step 13.1: Run content seed against local test DB (manual smoke)**

Run:
```bash
DATABASE_URL="postgresql://test:test@localhost:5433/smpn3_test?schema=public" npm run db:seed:content
```

Expected: success.

- [ ] **Step 13.2: Wire content seed into Playwright global-setup**

The local smoke in 13.1 populates the dev DB, but CI starts from a fresh Postgres each run. Add content seed to `playwright/global-setup.ts` AFTER `prisma migrate deploy` and BEFORE the e2e user fixture seeding.

Modify `playwright/global-setup.ts`:

```ts
// existing imports + setup …
execSync('npx prisma migrate deploy', { ... });

// NEW: seed content tables. Idempotent + required for api-source E2E.
execSync('npx tsx scripts/seed-content.ts', {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
});

// existing: delete e2e users + recreate them …
```

Verify by reading the file:
```bash
grep -n "seed-content" playwright/global-setup.ts
```
Should show one match.

- [ ] **Step 13.3: Update Playwright env to use api source**

In `playwright.config.ts`, find `webServer.env.NEXT_PUBLIC_DATA_SOURCE: 'static'` and change to `'api'`.

Verify:
```bash
grep -n "NEXT_PUBLIC_DATA_SOURCE" playwright.config.ts
```
Should show `'api'`.

- [ ] **Step 13.4: Run visual baseline tests against api source**

Run: `npm run e2e -- playwright/tests/visual-baseline.spec.ts`
Expected: 5 tests pass (no pixel diff vs the baselines re-captured post-CTA-change in Task 4).

If any test fails: a visible drift was introduced by the data layer. Inspect screenshot diff in `test-results/`. Most likely causes (and where to fix):
- **Order of items differs**: teachers (must be pimpinan→guru→tu, not alphabetical) → check seed `categoryOrder` (Task 10) + teacher-repo `ORDER BY categoryOrder` (Task 8).
- **Counts differ**: home shows 11 achievements not 5, or 18 gallery items not 8 → `featuredIds` not stored or not used → check seed page-section dump (Task 10) + assembler `getAchievementsByIds` / `getGalleryItemsByIds` (Task 11).
- **Missing field**: assembler returns undefined where static had a value → cross-reference seed page-section sectionKey vs assembler's `sections.<key> as ...` cast.

Once all pass, no fixes needed.

- [ ] **Step 13.5: Run public smoke test too**

Run: `npm run e2e -- playwright/tests/public-smoke.spec.ts`
Expected: 5 tests pass (no console errors).

- [ ] **Step 13.6: Run full Playwright suite (login + public + visual baseline)**

Run: `npm run e2e`
Expected: 15 tests pass total (5 login/force-change + 5 public smoke + 5 visual baseline).

- [ ] **Step 13.7: Update `.env.local` for local dev**

In `.env.local`, change:
```
NEXT_PUBLIC_DATA_SOURCE=static
```
To:
```
NEXT_PUBLIC_DATA_SOURCE=api
```

Use sed:
```bash
sed -i.bak 's/^NEXT_PUBLIC_DATA_SOURCE=static/NEXT_PUBLIC_DATA_SOURCE=api/' .env.local && rm -f .env.local.bak
grep NEXT_PUBLIC_DATA_SOURCE .env.local
```

Expected: `NEXT_PUBLIC_DATA_SOURCE=api`.

- [ ] **Step 13.8: Manual smoke**

Run dev server: `DATABASE_URL="postgresql://test:test@localhost:5433/smpn3_test?schema=public" PORT=3001 npm run dev` (background).

In browser (or curl):
- `/` — renders home, same as Phase 0
- `/profil` — renders profil, list guru/prestasi from DB
- `/akademik` — mapel tabs work
- `/fasilitas` — gallery + ekskul + sarana
- `/kontak` — faq list + form
- Check console: no errors

Stop dev server when done.

- [ ] **Step 13.9: Commit**

```bash
git add playwright.config.ts playwright/global-setup.ts
git commit -m "feat(data): switch NEXT_PUBLIC_DATA_SOURCE to api + verify visual parity"
```

Note: `.env.local` is gitignored, so its change is local only. Document in README (Task 14).

---

### Task 14: Update README + deploy notes + Phase 1 status

**Files:**
- Modify: `README.md`
- Modify: `scripts/deploy.sh` (add content seed step)

- [ ] **Step 14.1: Update README status**

In `README.md`, replace the Phase 0 status block with:
```markdown
## Status

**Phase 1 (Data migration): ✅ Complete** — public site now reads all content from Postgres via `ApiContentProvider` (`NEXT_PUBLIC_DATA_SOURCE=api`). Visual regression tests confirm no drift from Phase 0. CTA "Info PPDB" diganti "Kontak". Seed script populates DB dari `src/config/` (idempotent).

**Phase 0 (Foundation): ✅ Complete** — server runtime + Postgres + Prisma, NextAuth v5 (Edge/Node split) + bcrypt, login flow, force-password-change flow, audit log, middleware auth guard, health check, idempotent seed, Playwright E2E + Jest integration tests, GitHub Actions CI, Hostinger VPS deploy script.

Phase 2 selanjutnya akan membangun admin dashboard CRUD UI. Lihat [docs/superpowers/specs/](./docs/superpowers/specs/) dan [docs/superpowers/plans/](./docs/superpowers/plans/) untuk roadmap lengkap.
```

- [ ] **Step 14.2: Update deploy script to run content seed**

In `scripts/deploy.sh`, add a seed step right after `npx prisma migrate deploy`:

```bash
echo "==> Seed content (Phase 1: idempotent population from src/config/)"
# TODO Phase 2: when admin CRUD ships, this will overwrite admin edits on every deploy.
# Conditionalize (e.g., only run if no admin-edited marker row) or remove from deploy.sh.
npm run db:seed:content
```

Place it before `npm run build`.

- [ ] **Step 14.3: Update README with Phase 1 deployment instructions**

In the `## Status` block or a new subsection, add:

```markdown
### Phase 1 deployment notes

**⚠️ WAJIB**: Set `NEXT_PUBLIC_DATA_SOURCE=api` di production env (PM2 ecosystem file atau systemd env) sebelum first Phase 1 deploy. Tanpa ini, site tetap render dari StaticContentProvider (stale snapshot dari src/config/) — admin edits di Phase 2+ tidak akan muncul.

**Verify production env**:
```bash
# Di VPS, sebelum deploy:
echo $NEXT_PUBLIC_DATA_SOURCE   # harus "api"
```

**First-time deploy flow** (deploy script handle ini otomatis):
1. `prisma migrate deploy` — apply schema
2. `npm run db:seed:content` — populate dari src/config/ (idempotent)
3. `npm run build` — production build dengan api source
4. `pm2 reload smpn3`

**Dev lokal**: setelah migrate, jalankan `DATABASE_URL="..." npm run db:seed:content` dan set `NEXT_PUBLIC_DATA_SOURCE=api` di `.env.local`.

**⚠️ Phase 2 caveat**: deploy script saat ini selalu re-seed dari src/config/. Setelah Phase 2 (admin CRUD) ship, edit production data via admin UI akan **overwritten** oleh deploy. Phase 2 plan akan mengkonditionalisasi seed (e.g., hanya kalau marker row absent, atau hapus step ini dari deploy.sh).
```

- [ ] **Step 14.4: Run all checks**

```bash
npm run lint
npm run typecheck
npm test
npm run test:int
npm run e2e
SKIP_ENV_VALIDATION=true npm run build
```

Expected: all green.

- [ ] **Step 14.5: Commit**

```bash
git add README.md scripts/deploy.sh
git commit -m "docs(phase-1): update README + add content seed to deploy script"
```

---

## Phase 1 Done Criteria

- [ ] All entity tables + PageSection migration applied (`prisma/migrations/<timestamp>_phase1_content_schema/`)
- [ ] Schema includes `categoryOrder` on Teacher + Extracurricular (display order != alphabetical)
- [ ] Zod schemas for SiteConfig, Navigation, and all 8 entities
- [ ] 11 repository files. Achievement + Gallery repos have BOTH all-fetch AND by-ids variants
- [ ] 5 assembler files. Home + Profil + Fasilitas use `featuredIds` to scope per-page lists
- [ ] `ApiContentProvider` fully implemented (no more `notImplemented()`)
- [ ] `scripts/seed-content.ts` idempotent (verified by integration test) + stores `featuredIds` per page section
- [ ] `npm run db:seed:content` populates DB from static config
- [ ] CTA "Info PPDB" → "Kontak" (config + Navbar + test guard updated, tests pass)
- [ ] Visual baseline tests pass with `NEXT_PUBLIC_DATA_SOURCE=api` (specifically: home shows 5 achievements + 8 gallery, NOT 11/18; teachers ordered pimpinan→guru→tu, NOT alphabetically)
- [ ] Public site smoke tests pass with `api` source
- [ ] All Phase 0 E2E still pass (login, force-change-password)
- [ ] Playwright global-setup runs `scripts/seed-content.ts` so CI works from fresh DB
- [ ] `npm test` green (existing 83 + ~30 new unit tests)
- [ ] `npm run test:int` green (existing 14 + ~25 new integration tests)
- [ ] `npm run build` clean
- [ ] `npm run lint` + `npm run typecheck` clean
- [ ] `NEXT_PUBLIC_API_BASE_URL` removed from `env.ts` and `.env.example` (dead config)
- [ ] `getContentProvider.test.ts` updated for new constructor signature
- [ ] StaticContentProvider still compiles (regression safety — `npm run typecheck` covers this)
- [ ] README updated with Phase 1 status + production env warning (`NEXT_PUBLIC_DATA_SOURCE=api`)
- [ ] Deploy script includes content seed step + Phase 2 TODO comment
- [ ] `.env.local` switched to `api` (documented in README; gitignored so not committed)

---

## What's NOT in Phase 1 (explicit deferrals)

- ❌ Admin CRUD UI → **Phase 2**
- ❌ Cache invalidation on mutation (`revalidateTag`) → **Phase 2** (Phase 1 has tags but never invalidates because no mutations yet)
- ❌ Media library / Cloudinary → **Phase 3**
- ❌ Inline editor → **Phase 4**
- ❌ MediaAsset / MediaUsage CRUD (schema seeded empty, code not exercised) → **Phase 3**
