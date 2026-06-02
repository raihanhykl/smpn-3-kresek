# Phase 5 — Admin-Editable Page-Section Photos Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a non-technical school admin replace the 6 non-entity section photos (Hero, Sambutan/kepsek, About×2, Sejarah, Kurikulum) via a new `/admin/entities/pages` editor, reusing the existing PhotoPicker + crop + Cloudinary infra. Absent a photo, each section keeps its current gradient/emoji placeholder.

**Architecture:** Each section type gains an optional `photo?: Photo` (About gets `photoMain?`/`photoSub?`). Photos persist inside the existing `PageSection` JSONB via a new read-modify-write `setPageSectionPhoto`. A new fixed-slot admin editor (settings-form style, not EntityTable) binds PhotoPicker per slot with the section's locked crop ratio. Render components fall back to placeholder when no photo. No Prisma migration (JSONB).

**Tech Stack:** Next.js 15, React 19, Prisma 6 (PageSection JSONB), Zod 3, react-hook-form 7, jest 29. Reuses: `Photo` type, `photoSchema`, `PhotoPicker`, `CropModal`, `cldUrl(...crop)`, `cropOf`, `syncPhotoUsage`.

**Spec:** `docs/superpowers/specs/2026-06-02-phase5-page-section-photos-design.md`

---

## Chunk 0: Types + Zod patch + repo writer

No UI. Makes section photos representable + persistable. After it, sections still render placeholders (no render change yet).

### Task 0.1: Add optional `photo` to the 5 section types

**Files:** `src/config/types.ts`

- [ ] **Step 1: Edit each type** (all optional, `| undefined` for exactOptionalPropertyTypes parity with any future Zod inference):
  - `HeroConfig` → add `photo?: Photo | undefined;`
  - `SambutanConfig` → add `photo?: Photo | undefined;` (keep `photoEmoji`, `photoPlaceholderText`)
  - `AboutConfig` → add `photoMain?: Photo | undefined;` and `photoSub?: Photo | undefined;`
  - `KurikulumConfig` → add `photo?: Photo | undefined;`
  - The `sejarah` section type (inline in `ProfilePageConfig`, or a named `SejarahSection`) → add `photo?: Photo | undefined;`
  Add a one-line comment on each: `// Phase 5: optional admin-set photo; absent = gradient/emoji placeholder.`
  Ensure `Photo` is imported/in-scope in types.ts (it's defined there — same file).

- [ ] **Step 2: Typecheck** — `npm run typecheck` → PASS (optional, no consumers break).

### Task 0.2: Zod photo-patch schema for the editor

**Files:** Create `src/lib/validation/schemas/page-sections/photo-patch.ts`; Test: `src/__tests__/lib/validation/page-section-photo-patch.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { pageSectionPhotoPatchSchema } from '@/lib/validation/schemas/page-sections/photo-patch';

const url = { kind: 'url', src: 'smpn3kresek/image/abc', alt: 'x' };

it('accepts a valid hero photo patch', () => {
  expect(pageSectionPhotoPatchSchema.safeParse({
    pageKey: 'home', sectionKey: 'hero', field: 'photo', photo: url,
  }).success).toBe(true);
});

it('accepts about photoMain / photoSub fields', () => {
  expect(pageSectionPhotoPatchSchema.safeParse({
    pageKey: 'home', sectionKey: 'about', field: 'photoMain', photo: url,
  }).success).toBe(true);
  expect(pageSectionPhotoPatchSchema.safeParse({
    pageKey: 'home', sectionKey: 'about', field: 'photoSub', photo: url,
  }).success).toBe(true);
});

it('rejects an unknown sectionKey or field', () => {
  expect(pageSectionPhotoPatchSchema.safeParse({
    pageKey: 'home', sectionKey: 'nope', field: 'photo', photo: url,
  }).success).toBe(false);
  expect(pageSectionPhotoPatchSchema.safeParse({
    pageKey: 'home', sectionKey: 'hero', field: 'photoSub', photo: url,
  }).success).toBe(false); // hero has no photoSub — see refine
});

it('accepts a gradient photo (placeholder reset)', () => {
  expect(pageSectionPhotoPatchSchema.safeParse({
    pageKey: 'home', sectionKey: 'sambutan', field: 'photo',
    photo: { kind: 'gradient', from: '#1565C0', to: '#1E88E5', emoji: '👤' },
  }).success).toBe(true);
});
```

- [ ] **Step 2: Run, verify fail** — `npm test -- page-section-photo-patch` → FAIL (module missing).

- [ ] **Step 3: Implement the schema**

```ts
import { z } from 'zod';
import { photoSchema } from '../shared';

// The fixed catalog of editable section-photo slots. Keep this as the single
// source of truth the admin editor iterates over (Task 2.x reuses it).
export const PAGE_PHOTO_SLOTS = [
  { pageKey: 'home',     sectionKey: 'hero',      field: 'photo',     label: 'Foto Latar Beranda (Hero)',     aspect: 16 / 9 },
  { pageKey: 'home',     sectionKey: 'sambutan',  field: 'photo',     label: 'Foto Kepala Sekolah',           aspect: 4 / 5 },
  { pageKey: 'home',     sectionKey: 'about',     field: 'photoMain', label: 'Foto Tentang Kami (Utama)',     aspect: 4 / 3 },
  { pageKey: 'home',     sectionKey: 'about',     field: 'photoSub',  label: 'Foto Tentang Kami (Kecil)',     aspect: 1 / 1 },
  { pageKey: 'profil',   sectionKey: 'sejarah',   field: 'photo',     label: 'Foto Sejarah',                  aspect: 5 / 6 },
  { pageKey: 'akademik', sectionKey: 'kurikulum', field: 'photo',     label: 'Foto Kurikulum',                aspect: 4 / 3 },
] as const;

export type PagePhotoSlot = (typeof PAGE_PHOTO_SLOTS)[number];

export const pageSectionPhotoPatchSchema = z
  .object({
    pageKey: z.enum(['home', 'profil', 'akademik']),
    sectionKey: z.enum(['hero', 'sambutan', 'about', 'sejarah', 'kurikulum']),
    field: z.enum(['photo', 'photoMain', 'photoSub']),
    photo: photoSchema,
  })
  .superRefine((p, ctx) => {
    // The (sectionKey, field) combo must be a real slot.
    const ok = PAGE_PHOTO_SLOTS.some(
      (s) => s.pageKey === p.pageKey && s.sectionKey === p.sectionKey && s.field === p.field,
    );
    if (!ok) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Slot foto tidak dikenal' });
    }
  });

export type PageSectionPhotoPatch = z.infer<typeof pageSectionPhotoPatchSchema>;
```

- [ ] **Step 4: Run, verify pass** — `npm test -- page-section-photo-patch` → PASS.

### Task 0.3: Repo writer `setPageSectionPhoto` + reader for the editor

**Files:** `src/lib/data/repositories/page-section-repo.ts`; Test: `src/__tests__/integration/repositories/page-section-photo.test.ts`

- [ ] **Step 1: Write failing integration test**

```ts
import { prisma } from '@/lib/db/client';
import { setPageSectionPhoto } from '@/lib/data/repositories/page-section-repo';

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
    const photo = { kind: 'url' as const, src: 'smpn3kresek/image/abc', alt: 'x', cropX: 0.1, cropY: 0.1, cropW: 0.5, cropH: 0.5 };
    const merged = await setPageSectionPhoto('home', 'hero', 'photo', photo);
    expect(merged.badge).toBe('X');        // untouched
    expect(merged.titleLine1).toBe('A');   // untouched
    expect(merged.photo).toEqual(photo);   // added
    const row = await prisma.pageSection.findUnique({ where: { pageKey_sectionKey: { pageKey: 'home', sectionKey: 'hero' } } });
    expect((row!.data as any).photo.src).toBe('smpn3kresek/image/abc');
  });

  it('returns prev photo on read for syncPhotoUsage diffing', async () => {
    // set once
    await setPageSectionPhoto('home', 'hero', 'photo', { kind: 'url', src: 'a', alt: 'x' });
    const merged = await setPageSectionPhoto('home', 'hero', 'photo', { kind: 'url', src: 'b', alt: 'y' });
    expect(merged.photo.src).toBe('b');
  });
});
```

> Confirmed: `@@unique([pageKey, sectionKey])` generates the compound key `pageKey_sectionKey` (already used by `scripts/seed-content.ts`). Also confirmed: writing a `Record<string, unknown>` into the `data: Json` column requires `as Prisma.InputJsonValue` under this repo's strict config — see writer.

- [ ] **Step 2: Run, verify fail** — `npm run test:int -- page-section-photo` → FAIL.

- [ ] **Step 3: Implement writer + raw reader**

Add to `page-section-repo.ts`:
```ts
import { Prisma } from '@prisma/client';
import type { Photo } from '@config/types';
// NOTE: do NOT import revalidateTag in the repo — revalidation lives in the action.

/**
 * Read-modify-write a single photo field into a section's JSON, leaving every
 * other key intact. Returns the merged section data. Caller revalidates +
 * syncs MediaUsage. (No optimistic lock — admin team is tiny; the immediate
 * re-read keeps the clobber window minimal.)
 */
export async function setPageSectionPhoto(
  pageKey: string,
  sectionKey: string,
  field: 'photo' | 'photoMain' | 'photoSub',
  photo: Photo,
): Promise<Record<string, unknown> & { [k: string]: unknown }> {
  const row = await prisma.pageSection.findUnique({
    where: { pageKey_sectionKey: { pageKey, sectionKey } },
  });
  if (!row) throw new Error(`PageSection ${pageKey}/${sectionKey} not found`);
  const current = (row.data ?? {}) as Record<string, unknown>;
  const next = { ...current, [field]: photo };
  await prisma.pageSection.update({
    where: { pageKey_sectionKey: { pageKey, sectionKey } },
    // `next` is Record<string, unknown> (read-modify-write of arbitrary section
    // JSON); Prisma's Json input is InputJsonValue, to which Record<string,
    // unknown> is NOT assignable under strict — cast. Shape is already
    // Zod-validated upstream by pageSectionPhotoPatchSchema in the action.
    data: { data: next as Prisma.InputJsonValue },
  });
  return next;
}

/** Read current photo for a slot (for syncPhotoUsage prev-diff + editor seed). */
export async function getPageSectionPhoto(
  pageKey: string,
  sectionKey: string,
  field: 'photo' | 'photoMain' | 'photoSub',
): Promise<Photo | null> {
  const row = await prisma.pageSection.findUnique({
    where: { pageKey_sectionKey: { pageKey, sectionKey } },
  });
  const data = (row?.data ?? {}) as Record<string, unknown>;
  const p = data[field];
  return p && typeof p === 'object' ? (p as Photo) : null;
}
```

- [ ] **Step 4: Run, verify pass** — `npm run test:int -- page-section-photo` → PASS.

- [ ] **Step 5: Verify + commit Chunk 0**

```bash
npm run typecheck && npm test && npm run test:int
git add -A && git commit -m "feat(phase5-chunk0): section photo types + Zod patch + PageSection writer

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Chunk 1: Server action + admin editor UI

After this chunk an admin can open `/admin/entities/pages`, upload/crop each of the 6 slots, and it persists. (Render still placeholder until Chunk 2.)

### Task 1.1: Server action

**Files:** Create `src/app/(admin)/admin/entities/_actions/page-section-actions.ts`

- [ ] **Step 1: Implement, mirroring gallery-actions.ts**

```ts
'use server';
import { revalidateTag } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { withRole, type ActionResult } from '@/lib/auth/server-action-guard';
import { writeAudit } from '@/lib/security/audit';
import { pageSectionPhotoPatchSchema } from '@/lib/validation/schemas/page-sections/photo-patch';
import { setPageSectionPhoto, getPageSectionPhoto } from '@/lib/data/repositories/page-section-repo';
import { syncPhotoUsage } from '@/lib/media/sync-photo-usage';

export async function updatePageSectionPhotoAction(raw: unknown): Promise<ActionResult<void>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    const patch = pageSectionPhotoPatchSchema.parse(raw);
    const prev = await getPageSectionPhoto(patch.pageKey, patch.sectionKey, patch.field);
    await setPageSectionPhoto(patch.pageKey, patch.sectionKey, patch.field, patch.photo);
    await syncPhotoUsage(prev, patch.photo, {
      usedInTable: 'PageSection',
      usedInId: `${patch.pageKey}:${patch.sectionKey}:${patch.field}`,
      usedInField: 'photo',
    });
    await writeAudit({
      userId: user.id,
      action: 'update_page_photo',
      target: `${patch.pageKey}/${patch.sectionKey}/${patch.field}`,
    }).catch(() => {});
    revalidateTag(`page:${patch.pageKey}`);
  });
}
```

- [ ] **Step 2: Typecheck** — `npm run typecheck` → PASS.

### Task 1.2: Editor page + manager

**Files:** Create `src/app/(admin)/admin/entities/pages/page.tsx` and `PageSectionPhotoManager.tsx`

- [ ] **Step 1: page.tsx** — server component: `auth()` → load each slot's current photo via `getPageSectionPhoto` (Promise.all over `PAGE_PHOTO_SLOTS`) → render `<AdminShell><PageSectionPhotoManager slots={...} /></AdminShell>`. Mirror `gallery/page.tsx` structure (`export const dynamic = 'force-dynamic'`).

- [ ] **Step 2: PageSectionPhotoManager.tsx** — client component. NOT EntityTable. A grouped list (by pageKey: Beranda / Profil / Akademik) of fixed slots. For each slot render a card: label + a `PhotoPicker` (via local state, not a full RHF form is needed but RHF Controller is fine) seeded with the current photo (or a gradient default), `cropAspect={slot.aspect}`, `openImagePicker` from `useImagePicker`. A "Simpan" button per slot calls `updatePageSectionPhotoAction({ pageKey, sectionKey, field, photo })` inside `startTransition`; show saved/error inline. Reuse `mapActionError`.
  - Default gradient when a slot has no photo yet: `{ kind:'gradient', from:'#1565C0', to:'#1E88E5', emoji: <slot-appropriate, e.g. 👤 for sambutan, 🏫 otherwise> }`.
  - IMPORTANT: opening the picker must happen OUTSIDE `startTransition` (the Phase-4 documents bug) — open picker → on result, then `startTransition` the save. Follow the corrected `DocumentSlotManager.attach` pattern.

- [ ] **Step 3: Typecheck** — `npm run typecheck` → PASS.

### Task 1.3: Nav + dashboard card

**Files:** `src/config/admin-nav.ts`, `src/app/(admin)/admin/dashboard/page.tsx`

- [ ] **Step 1: Add nav item** to the "Konten" group (after Media or near top):
  `{ label: 'Halaman & Foto', href: '/admin/entities/pages', icon: '📄', roles: ['ADMIN', 'EDITOR'] }`

- [ ] **Step 2: Add a dashboard card** mirroring the existing card pattern (link to `/admin/entities/pages`).

- [ ] **Step 3: Typecheck + lint + commit Chunk 1**

```bash
npm run typecheck && npm run lint && npm test
git add -A && git commit -m "feat(phase5-chunk1): page-section photo admin editor + action + nav

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Chunk 2: Render components honor the photo

After this chunk, a set photo shows on the public site; an unset slot keeps its placeholder.

### Task 2.1: `<img>` sections (Sambutan, About×2, Sejarah, Kurikulum)

**Files:** `SambutanSection.tsx`, `AboutSection.tsx`, `SejarahSection.tsx`, `KurikulumSection.tsx`

- [ ] For each, wrap the existing placeholder in a conditional. Pattern (Sambutan example, container is `aspect-[4/5]`):
```tsx
{sambutan.photo?.kind === 'url' ? (
  // eslint-disable-next-line @next/next/no-img-element -- Cloudinary CDN already optimises
  <img src={cldUrl(sambutan.photo.src, 'card', cropOf(sambutan.photo))}
       alt={sambutan.photo.alt}
       className="h-full w-full object-cover" />
) : (
  /* existing gradient + emoji placeholder, unchanged */
)}
```
  - AboutSection has TWO: `about.photoMain` (main `aspect-[4/3]`) and `about.photoSub` (`aspect-square` badge). Wrap each independently.
  - Keep each placeholder branch byte-identical to today for the `else`.
  - Import `cldUrl, cropOf` from `@/lib/media/cldUrl`.
  - RATIO SAFETY: put the SAME `aspect-[...]` container class on the rendered `<img>`'s wrapper as on the placeholder branch (about-sub `aspect-square`, sejarah `aspect-[5/6]`, about-main/kurikulum `aspect-[4/3]`, sambutan `aspect-[4/5]`) and keep `object-cover`. The `card` variant delivers 3:2 on the no-crop path, so the fixed-aspect container + object-cover is what guarantees the visible ratio; the editor locks `cropAspect={slot.aspect}` so a cropped photo already matches. Easiest: keep the existing aspect wrapper `<div>` and only swap its INNER content (placeholder vs `<img className="h-full w-full object-cover">`).

- [ ] **Typecheck** — `npm run typecheck` → PASS.

### Task 2.2: Hero (CSS background) + drop the Unsplash default

**Files:** `src/components/organisms/home/HeroSection.tsx`

- [ ] **Step 1:** Replace the hardcoded Unsplash `background: url(...)` so that:
  - If `hero.photo?.kind === 'url'`: `background: url('${cldUrl(hero.photo.src, 'hero', cropOf(hero.photo))}') center/cover no-repeat`.
  - Else: a clean brand gradient (drop the stranger's stock photo) — e.g. keep the existing blue gradient layer alone, OR a neutral `linear-gradient`. Decision: NO stock photo when unset.
  - Keep the overlay gradient + `opacity-25 mix-blend-overlay` exactly as today (faded-background look, per spec).
  - Build the `background` string in a `const heroBg = ...` above the JSX for readability.
  - INTENDED VISUAL (not a bug): the admin photo is injected into the existing `opacity-25 mix-blend-overlay` child layer, so it renders DELIBERATELY FADED behind the blue gradient + dark overlay — matching today's stock-photo look. Do NOT add a separate bright/full-opacity photo layer. The only change vs today is the source (admin Cloudinary photo, or pure gradient when unset) instead of the hardcoded Unsplash URL. Manual-smoke (Chunk 4) should confirm "faded background, blue overlay still legible," which is correct.
  - Layer structure (verified): `section[blue-gradient] > div.opacity-25.mix-blend-overlay[bg:photo] + div[dark-overlay]`. Inject the URL into the `.opacity-25` child's `background`, NOT the section or the dark overlay.

- [ ] **Step 2: Typecheck + lint** — PASS.

- [ ] **Step 3: Commit Chunk 2**

```bash
git add -A && git commit -m "feat(phase5-chunk2): render section photos (img + hero bg), drop stock hero

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Chunk 3: Seed alignment + full verification

### Task 3.1: Seed stays clean (no photos by default)

**Files:** `scripts/seed-content.ts` (verify only)

- [ ] Confirm the config objects do NOT carry a `photo` key (so seed writes none → sections render placeholder). The new optional types allow their absence. Reseed and verify zero section photos:
```bash
npm run db:seed:content
# spot check: hero/sambutan section JSON has no 'photo' key
PGPASSWORD=raihanhykl psql -h localhost -U postgres -d smpn_3_kresek_pkm -c "SELECT \"sectionKey\", data ? 'photo' AS has_photo FROM \"PageSection\" WHERE \"pageKey\"='home' AND \"sectionKey\" IN ('hero','sambutan','about');"
```
Expected: `has_photo = f` for all (placeholder path).

### Task 3.2: Full suite + build

- [ ] `npm run typecheck && npm run lint && npm test && npm run test:int && npm run build` — all green.

### Task 3.3: Commit + (optional) push

```bash
git add -A && git commit -m "test(phase5-chunk3): reseed sanity + full-suite green

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Chunk 4: Manual smoke (human-driven; agent provides checklist)

- [ ] `/admin/entities/pages` loads, shows 6 slots grouped by page, each with placeholder preview.
- [ ] For EACH slot: pick image → "Atur Posisi" → pan/zoom in the slot's locked ratio → Simpan → preview updates → public page reflects it:
  - Hero → `/` (faded background, blue overlay still legible)
  - Sambutan → `/` kepsek block
  - About main + sub → `/` tentang-kami
  - Sejarah → `/profil`
  - Kurikulum → `/akademik`
- [ ] Reset a slot back to gradient (pick gradient kind) → public page returns to placeholder.
- [ ] Media library: an uploaded page photo is NOT flagged orphan (MediaUsage tracked).

---

## Notes for the implementer

- **DRY:** `PAGE_PHOTO_SLOTS` is the single catalog — editor, action validation, and editor-page loader all iterate it. Don't hardcode the slot list twice.
- **No regression contract:** every section render keeps its exact placeholder in the `else` branch; an absent `photo` must look identical to today. Hero is the only intentional visual change when unset (stock photo → gradient).
- **exactOptionalPropertyTypes ON:** section `photo?: Photo | undefined`; never write `{ photo: undefined }` into a section object.
- **Picker-in-transition bug:** open `useImagePicker` OUTSIDE `startTransition` (Phase 4 lesson) — the cropper modal won't mount otherwise.
- **No Prisma migration** — photos live in existing PageSection JSONB.
- **MediaUsage id scheme:** `usedInId = '<pageKey>:<sectionKey>:<field>'` keeps page photos distinct from entity rows.
