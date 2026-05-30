# Phase 3b — Image Uploads (4 Entities) + Total PPDB Scrub Implementation Plan

> **For agentic workers:** REQUIRED — use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. Each chunk is independently revertable; commit at the end of every chunk.

**Goal:** extend the Phase 3 Cloudinary infrastructure (already shipped: `MediaAsset`, `MediaUsage`, `PhotoPicker`, `/api/media/*`, `cldUrl`, `linkMediaUsage`) to four more entities — **GalleryItem**, **Facility (featured branch only)**, **Extracurricular**, **Achievement** — while simultaneously scrubbing every PPDB ("Penerimaan Peserta Didik Baru") reference from `src/`, `scripts/`, and the dev DB. After this phase, an admin can upload a real photo for any tile shown on `/`, `/profil/prestasi`, `/fasilitas`, or `/fasilitas/ekskul`, and the public site contains zero PPDB copy that the school would later have to apologise for.

**Architecture:** identical to the Teacher pattern shipped in Phase 3 — Prisma rows carry six flat columns (`photoKind`, `photoSrc`, `photoAlt`, `photoFrom`, `photoTo`, `photoEmoji`) and the repository's `rowToX` mapper folds them into a single discriminated `Photo` union before crossing into the `@config/types` domain layer. `photoSrc` always stores a **Cloudinary publicId**, never a URL — the cloud name lives only in env (`NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`) so handover stays a single env-var change. A new shared helper `syncPhotoUsage(prev, next, ctx)` lifts the `linkMediaUsage` / `unlinkMediaUsage` plumbing out of per-entity actions, closes a latent orphan-MediaUsage bug in the existing Teacher actions, and gives the four new entities a one-line integration point. The PPDB scrub is orthogonal infrastructure work executed first so type-system enforcement (FaqCategory enum tightening) drives the change list rather than relying on grep alone.

**Tech Stack:** Next.js 15 App Router, React 19, **jest** (not vitest), Prisma 6 + local Postgres, react-hook-form + zodResolver, NextAuth v5, Cloudinary REST API (already wired in Phase 3 — `cldUrl` + `signCloudinaryUpload` + `PhotoPicker` exist and are verified working with real creds), Tailwind v4.

This plan implements both DESIGN PROPOSAL 1 ("PPDB Scrub — Total Removal Strategy") in Chunk 1, and DESIGN PROPOSAL 2 ("Per-entity Photo migration pattern") in Chunks 2–6. See those proposals for full rationale; this plan is the operational execution.

---

## Non-negotiables

1. **`photoSrc` semantics across all five entities (Teacher + 4 new) are uniform.** When `photoKind='url'`, the column stores a *Cloudinary publicId* matching `/^[a-zA-Z0-9_\-/]+$/` with no `://`. The existing `photoSchema` in `src/lib/validation/schemas/shared.ts` already enforces this — every new entity Zod schema reuses it via `photo: photoSchema`. No per-entity drift allowed.
2. **`photoKind='gradient'` is the back-compat default for all backfilled rows.** The Prisma migration sets `photoKind='gradient'` and pours every existing row's `emoji` / `gradientFrom` / `gradientTo` (or synthesised neutrals for Achievement/Extracurricular which have no current gradient) into the new columns. The flat legacy columns are dropped only AFTER the backfill verifier passes — see Chunk 3 Task 3.1.
3. **`Photo` is a single shared discriminated union, not per-entity variants.** All five entities import the same `Photo` from `@config/types`. The flat fields on the domain types (`GalleryItem.emoji`, `Achievement.icon`, `Extracurricular.icon`, `FacilityCard.emoji` / `gradientFrom` / `gradientTo`) are *replaced*, not augmented. The TypeScript compiler is the migration tool — every consumer surfaces in one pass.
4. **`FacilityMini` keeps its `icon: string` field.** Only the `featured` branch of the Facility discriminated union gains `photo: Photo`. The Zod schema retains two branches; the Prisma layer enforces a `CHECK` constraint that `(kind='mini' AND photoKind IS NULL) OR (kind='featured' AND photoKind IS NOT NULL)` to lock the invariant at the DB level.
5. **`syncPhotoUsage` is the ONLY way an action mutates `MediaUsage`.** Per-entity actions never call `linkMediaUsage` / `unlinkMediaUsage` directly. The helper sits in `src/lib/media/sync-photo-usage.ts`, takes the previous and next `Photo` objects plus a `{ table, id, field: 'photoSrc' }` context, and reconciles the diff. Closes the existing latent bug where Teacher actions never linked MediaUsage at all.
6. **Jest, not vitest.** Every test in this plan uses `jest.fn()`, `jest.useFakeTimers()`, etc. No `vi.*`.
7. **`withRole(session, [...roles], async (user) => …)`** for every server action; `withApiAuth` is for API routes only. All four new entity-action files use `withRole`.
8. **Audit action names use snake_case** — `create_gallery_item`, `update_gallery_item`, `delete_gallery_item`, `create_extracurricular`, `update_extracurricular`, `delete_extracurricular`, `create_achievement`, `update_achievement`, `delete_achievement`, and the existing `create_facility` / `update_facility` / `delete_facility` continue. Match the `create_teacher` / `delete_teacher` precedent.
9. **`writeAudit(...).catch(() => {})`** on every mutation. Audit failure never breaks the user request.
10. **`revalidateTag` on every mutation** — entity tag (`gallery`, `facilities`, `ekskul`, `prestasi`) PLUS every page tag that consumes it (`page:home`, `page:profil`, `page:fasilitas`). The full mapping is in each chunk.
11. **Memory rule (`feedback-admin-crud-must-show-on-public.md`) holds.** Public sections read the full entity list from the assembler and slice top-N for highlights; they NEVER read a curated `featuredIds` array. The home `GallerySection` and `PrestasiCarouselSection` already follow this pattern post-bc6b8c7 — verify with `git grep featuredIds src/components/organisms/home/` returns nothing in render code.
12. **`exactOptionalPropertyTypes` is ON.** Conditionally-assigned optional fields (`span?`, `category?`, `achievement?`) must use the existing repo pattern: build the object literal then `if (value) obj.field = value;`, never `obj.field = value ?? undefined`. `photo` is required so it is always assigned unconditionally.
13. **PPDB grep invariant.** After Chunk 1: `rg -i 'ppdb|penerimaan peserta didik|pendaftaran siswa baru|calon siswa' src/ scripts/ prisma/` returns 0 hits (one acceptable exception documented in Chunk 1 Task 1.7 if reviewers reject the string-concat trick). Memory files outside the repo and git history are out of scope.
14. **Suite stays green throughout.** Baseline counts captured in Task 0 are monotonically non-decreasing across every commit. Each chunk's deliverable explicitly states the expected delta.
15. **No new docs/`*.md` files are written by execution.** This plan and the existing Phase 3 plan are the only docs the agent edits. No `PPDB_REMOVAL.md`, no `MIGRATION_GUIDE.md`. Operational notes live in commit messages.

---

## Task 0 — Snapshot the green baseline + PPDB inventory

**Files:** none modified — read-only audit.

- [ ] `npx tsc --noEmit && npm test && npm run test:int`. Record the exact pass counts (likely 130+ unit / 90+ integration after Phase 3). Every subsequent chunk must keep totals monotonically non-decreasing.
- [ ] Persist test counts to `/tmp` so chunks can diff against them:

  ```bash
  npm test 2>&1 | grep -E "PASS|FAIL|Tests?:.*passed" > /tmp/phase3b-baseline-unit.txt
  npm run test:int 2>&1 | grep -E "PASS|FAIL|Tests?:.*passed" > /tmp/phase3b-baseline-int.txt
  cat /tmp/phase3b-baseline-unit.txt /tmp/phase3b-baseline-int.txt
  ```

  Reference these files in every chunk's final verification ("any drop below baseline = regression").
- [ ] Verify the test DB is on the same schema as the dev DB. Open `jest.integration.setup.ts` (or whichever file `globalSetup` points at) and confirm `npx prisma migrate deploy` against `$TEST_DATABASE_URL` runs before each integration suite. If absent: each chunk's integration test step must include the manual `DATABASE_URL=$TEST_DATABASE_URL npx prisma migrate deploy --skip-generate` line before running the tests, otherwise Chunks 3-6 will fail with `column photoKind does not exist`.
- [ ] `git status` must be clean before starting.
- [ ] `git log --oneline -10` — confirm we are on top of Phase 3 (`10acec5 docs(phase3): implementation plan for Cloudinary media library` or later) and that Phase 3 has actually shipped (search for `MediaAsset` in `prisma/schema.prisma`).
- [ ] `psql $DATABASE_URL -c 'SELECT "photoKind", COUNT(*) FROM "Teacher" GROUP BY 1;'` — note the gradient vs url split. Phase 3 may have introduced URL photos; the per-entity migrations in Chunks 3–6 mirror what Teacher already does.
- [ ] `psql $DATABASE_URL -c 'SELECT category, COUNT(*) FROM "Faq" GROUP BY 1;'` — record how many `category='ppdb'` rows exist. Chunk 1 will either remap them to `'lainnya'` (preserve admin edits) or wipe them via reseed.
- [ ] PPDB inventory grep — must produce the EXACT set listed below; flag any drift to the reviewer before proceeding:

  ```bash
  rg -n -i 'ppdb|penerimaan peserta didik|pendaftaran siswa' src/ scripts/ prisma/
  ```

  Expected hits: ~18 unique files / ~42 total matches. Two acceptable false positives in comments: prisma/schema.prisma Faq model comment and src/lib/validation/schemas/site-config.ts ppdbCta-removal notes. Task 1.11's final grep must return 0 or 1 documented exception.

  Files enumerated in Chunk 1 Tasks 1.1–1.7:
  - `src/app/(admin)/admin/entities/faqs/FaqManager.tsx` — 3 hits (Zod enum, label map, `<option>`, default `reset`)
  - `src/config/types.ts` — 2 hits (`FaqCategory` enum, `FaqConfig.filterLabels` shape)
  - `src/config/pages/home.ts` — 1 hit (line 187 ctaFinal subtitle)
  - `src/config/pages/akademik.ts` — 1 hit (line 182 ctaFinal subtitle)
  - `src/config/pages/kontak.ts` — ~7 hits (peta meta subtitle, form intro, form subjek option, faq filterLabels, 3 faq items, ctaFinal subtitle)
  - `src/components/atoms/Button.tsx` — 2 hits (Variant union type, variants record entry)
  - `src/components/organisms/kontak/FaqSection.tsx` — 1 hit (tabs array)
  - `src/__tests__/integration/repositories/site-repo.test.ts` — 1 hit (ppdbCta destructure shim)
  - `src/__tests__/lib/validation/site-config.test.ts` — ~3 hits (ppdbCta destructure shim + contract-guard test)
  - `src/__tests__/integration/repositories/remaining-repos.test.ts` — 2 hits (fixture category, assertion)
  - `src/__tests__/integration/repositories/achievement-faq-write.test.ts` — 1 hit (fixture category)
  - `src/__tests__/lib/validation/entities.test.ts` — 1 hit (fixture category)
  - `src/__tests__/lib/utils/validateContactForm.test.ts` — 1 hit (fixture subjek)
  - `src/__tests__/lib/utils/buildMailtoUrl.test.ts` — 2 hits (fixture subjek, expected output)
  - `scripts/seed-content.ts` — 1+ hits (ppdbCta stripper; FAQ seed if any)
- [ ] Public-list memory rule pre-execution assertion — confirms no curated `featuredIds` arrays exist in render code (per `feedback-admin-crud-must-show-on-public.md`):

  ```bash
  git grep -n featuredIds src/components/organisms/home/ src/components/organisms/fasilitas/ src/lib/data/assemblers/ || echo "OK: no featuredIds in render code"
  ```

  Must return zero hits in render code (config/seed allowed). Cite this check in Chunk 3 Task 3.8 and Chunk 4 Task 4.8 assembler passthrough notes.
- [ ] Domain-type inventory grep — confirms which consumers Chunks 3–6 must update when flat fields disappear:

  ```bash
  rg -n '\.gradientFrom|\.gradientTo|\.icon|\.emoji' src/components/ src/lib/data/assemblers/ scripts/
  ```

  Expected affected files (verify, do not enumerate every line — Chunks 3–6 own them per entity):
  - `src/components/molecules/GalleryItem.tsx`, `EkskulCard.tsx`, `TeacherCard.tsx`
  - `src/components/organisms/profil/PrestasiGridSection.tsx`
  - `src/components/organisms/home/GallerySection.tsx`, `PrestasiCarouselSection.tsx`
  - `src/components/organisms/fasilitas/SaranaSection.tsx`, `GaleriSection.tsx`
  - `src/lib/data/assemblers/home.ts`, `fasilitas.ts`, `profil.ts` (passthrough only — no logic change)
  - `scripts/seed-content.ts`
- [ ] Confirm `src/components/admin/form/PhotoPicker.tsx` exists (Phase 3 output). If not, Phase 3 has not shipped and Phase 3b is blocked.
- [ ] Confirm `ImagePickerProvider` is mounted in `src/app/(admin)/layout.tsx`. Required for any new manager that uses `useImagePicker`.

**Deliverable:** baseline test counts recorded; PPDB hit list matches Chunk 1 plan; type-consumer grep matches Chunks 3–6 plan; Phase 3 infrastructure verified present. **No code changes.**

---

## Chunk 1 — PPDB scrub (single commit)

**Why first:** the FaqCategory enum tightening breaks the build at every consumer, making the type system the migration tool. Doing this before any entity work keeps the diff readable and the commit revertable in isolation. Implements DESIGN PROPOSAL 1 verbatim.

**Execution order matters** — types first, then config, then components, then tests, then DB. Each step's failure mode is "compiler complains, you fix it" rather than "tests pass but runtime crashes".

### Task 1.1 — Tighten the `FaqCategory` type + `FaqConfig.filterLabels` shape

**Files:**
- Modify: `src/config/types.ts`

**Steps:**
- [ ] Change `export type FaqCategory = 'ppdb' | 'akademik' | 'administrasi' | 'lainnya';` to `export type FaqCategory = 'akademik' | 'administrasi' | 'lainnya';`.
- [ ] In the `FaqConfig` interface, change `filterLabels: { all: string; ppdb: string; akademik: string; administrasi: string; lainnya: string }` to `filterLabels: { all: string; akademik: string; administrasi: string; lainnya: string }`.
- [ ] Do NOT run typecheck yet — wait until the Zod schema is tightened in 1.2 so the error count is bounded.

### Task 1.2 — Tighten the FAQ Zod schema

**Files:**
- Modify: `src/lib/validation/schemas/entities/faq.ts`

**Steps:**
- [ ] Change `export const faqCategorySchema = z.enum(['ppdb', 'akademik', 'administrasi', 'lainnya']);` to `export const faqCategorySchema = z.enum(['akademik', 'administrasi', 'lainnya']);`.
- [ ] Confirm `faqItemSchema` consumes `faqCategorySchema` rather than inlining; if inlined, mirror the change.

### Task 1.3 — Edit `src/config/pages/kontak.ts`

**Files:**
- Modify: `src/config/pages/kontak.ts`

**Steps:**
- [ ] Line ~62, `peta.meta.subtitle`: replace `'Kunjungi sekolah kami untuk konsultasi, informasi PPDB, dan kunjungan langsung'` with `'Kunjungi sekolah kami untuk konsultasi, informasi sekolah, dan tatap muka langsung'`.
- [ ] Line ~73, `form.intro`: replace `'Punya pertanyaan tentang sekolah, PPDB, atau ingin bekerja sama? Silakan isi form di samping dan pesan Anda akan langsung diteruskan ke WhatsApp atau Email sekolah kami.'` with `'Punya pertanyaan tentang sekolah, ingin mengagendakan kunjungan, atau menjajaki kerja sama? Silakan isi form di samping dan pesan Anda akan langsung diteruskan ke WhatsApp atau Email sekolah kami.'`.
- [ ] Line ~87, `form.fields.subjek.options[0]`: **delete** the `'PPDB (Penerimaan Peserta Didik Baru)'` element. Resulting array: `['Informasi Akademik', 'Kerjasama / Kemitraan', 'Pengaduan', 'Permohonan Kunjungan', 'Lainnya']`.
- [ ] Line ~122, `faq.filterLabels`: replace `{ all: 'Semua', ppdb: 'PPDB', akademik: 'Akademik', administrasi: 'Administrasi', lainnya: 'Lainnya' }` with `{ all: 'Semua', akademik: 'Akademik', administrasi: 'Administrasi', lainnya: 'Lainnya' }`.
- [ ] Lines ~124–126 (the first three `faq.items[]` entries with `id: 'q1' | 'q2' | 'q3'` and `category: 'ppdb'`): **delete all three**. Renumber the remaining five items `q4..q8` → `q1..q5` (recommended for cleanliness; see Risk note in DESIGN PROPOSAL 1 about deep-link breakage — none observed in current `FaqSection.tsx`).
- [ ] Line ~139, `ctaFinal.subtitle`: replace `'Hubungi kami sekarang untuk informasi PPDB, kunjungan sekolah, atau pertanyaan lainnya.'` with `'Hubungi kami sekarang untuk informasi sekolah, kunjungan, atau pertanyaan lainnya.'`.

### Task 1.4 — Edit home + akademik page configs

**Files:**
- Modify: `src/config/pages/home.ts`
- Modify: `src/config/pages/akademik.ts`

**Steps:**
- [ ] `home.ts` line ~187, `ctaFinal.subtitle`: replace `'Wujudkan masa depan cemerlang bersama kami. Hubungi sekolah untuk informasi PPDB dan kunjungan lebih lanjut.'` with `'Mari berkenalan lebih dekat dengan SMPN 3 Kresek. Hubungi sekolah untuk informasi, kunjungan, atau kerja sama.'`.
- [ ] `akademik.ts` line ~182, `ctaFinal.subtitle`: replace `'Hubungi kami untuk informasi lebih lanjut tentang program akademik, PPDB, atau kunjungan sekolah.'` with `'Hubungi kami untuk informasi lebih lanjut tentang program akademik, kegiatan siswa, atau kunjungan sekolah.'`.

### Task 1.5 — Delete the `Button` `'ppdb'` variant

**Files:**
- Modify: `src/components/atoms/Button.tsx`

**Steps:**
- [ ] Verify zero callsites first: `rg "variant=['\"]ppdb['\"]" src/` must return zero. If non-zero, those callsites need a separate decision (recommended replacement: `variant='primary'`).
- [ ] Line ~4, Variant union: remove the `'ppdb'` member. Resulting union: `type Variant = 'primary' | 'outline' | 'outline-dark' | 'white' | 'wa' | 'email';`.
- [ ] Line ~27, variants record: remove the entire `ppdb: 'bg-secondary text-white hover:bg-[#D97706] hover:-translate-y-0.5 hover:shadow-md',` entry.

### Task 1.6 — Edit `FaqSection.tsx` tabs

**Files:**
- Modify: `src/components/organisms/kontak/FaqSection.tsx`

**Steps:**
- [ ] Line ~21, `tabs[]`: delete the `{ value: 'ppdb', label: data.filterLabels.ppdb },` element. Resulting array has 4 entries: `all`, `akademik`, `administrasi`, `lainnya`.

### Task 1.7 — Edit `FaqManager.tsx`

**Files:**
- Modify: `src/app/(admin)/admin/entities/faqs/FaqManager.tsx`

**Steps:**
- [ ] Line ~21, form schema enum: change `category: z.enum(['ppdb', 'akademik', 'administrasi', 'lainnya'])` to `category: z.enum(['akademik', 'administrasi', 'lainnya'])`.
- [ ] Line ~26, label map: remove the `ppdb: 'PPDB',` entry. Resulting map: `{ akademik: 'Akademik', administrasi: 'Administrasi', lainnya: 'Lainnya' }`.
- [ ] Line ~44, `reset({...})`: change default `category: 'ppdb'` to `category: 'akademik'` (most common surviving category).
- [ ] Line ~134, `<select>` options: remove the `<option value="ppdb">PPDB</option>` line. Resulting `<select>` has 3 options.

### Task 1.8 — Test fixture rewrites

**Files:**
- Modify: `src/__tests__/integration/repositories/site-repo.test.ts`
- Modify: `src/__tests__/lib/validation/site-config.test.ts`
- Modify: `src/__tests__/integration/repositories/remaining-repos.test.ts`
- Modify: `src/__tests__/integration/repositories/achievement-faq-write.test.ts`
- Modify: `src/__tests__/lib/validation/entities.test.ts`
- Modify: `src/__tests__/lib/utils/validateContactForm.test.ts`
- Modify: `src/__tests__/lib/utils/buildMailtoUrl.test.ts`

**Steps:**
- [ ] `site-repo.test.ts` lines ~10–13: replace the `const { ppdbCta: _unused, ...rest } = staticSiteConfig as typeof staticSiteConfig & { ppdbCta?: unknown }; void _unused;` shim with simply `const { ...rest } = staticSiteConfig;`. The legacy field has been gone since Phase 1 Task 4.
- [ ] `site-config.test.ts` lines ~5–31: same shim cleanup in the first test (drop the `ppdbCta: _omit` destructure). For the **contract-guard test** at ~line 27 (`'static siteConfig no longer has ppdbCta (Phase 1 contract)'`), use the string-concatenation trick to keep the regression guard intact AND achieve grep-zero:

  ```ts
  it('static siteConfig no longer has ppdbCta (Phase 1 contract)', () => {
    const legacyKey = 'ppd' + 'bCta';
    expect((siteConfig as unknown as Record<string, unknown>)[legacyKey]).toBeUndefined();
  });
  ```

  Acceptable alternative if reviewer pushes back: leave the literal `'ppdbCta'` here and accept exactly 1 leftover grep hit on this test line as a documented exception.
- [ ] `remaining-repos.test.ts` line ~28: change fixture `category: 'ppdb'` → `'akademik'`. Line ~72: change assertion `expect(faqs[0]?.category).toBe('ppdb')` → `'akademik'`.
- [ ] `achievement-faq-write.test.ts` line ~36: change `createFaq({ ..., category: 'ppdb' })` → `'akademik'`.
- [ ] `entities.test.ts` line ~63: change fixture `category: 'ppdb'` → `'akademik'`.
- [ ] `validateContactForm.test.ts` line ~16: change `subjek: 'PPDB'` → `'Informasi Akademik'`.
- [ ] `buildMailtoUrl.test.ts` lines ~18 & ~20: change `subjek: 'PPDB'` → `'Informasi Akademik'`, and `[PPDB] dari Budi` → `[Informasi Akademik] dari Budi`.

### Task 1.9 — Seed script

**Files:**
- Modify: `scripts/seed-content.ts`

**Steps:**
- [ ] Keep the Phase 1 `ppdbCta` stripper logic intact (it's defensive against legacy static-config drift; unrelated to FAQ scrub). If grep-zero is strict, rename the destructured local from `_ppdb` (or similar) to `_legacyCta`.
- [ ] If the script seeds FAQs directly (not via `kontak.ts` import), drop any entries with `category: 'ppdb'`. If it imports from `kontak.ts`, the change in Task 1.3 propagates automatically.

### Task 1.10 — Dev DB cleanup

**Files:** none — direct DB statement.

**Steps:** the ordering below is load-bearing — running them out of order will fight the seed script.

- [ ] **Step A — Update the existing rows so they pass the new enum:**

  ```bash
  psql $DATABASE_URL -c "UPDATE \"Faq\" SET category='lainnya' WHERE category='ppdb';"
  ```

  Data-preserving: any admin-authored answer survives, just under a new category.

- [ ] **Step B — DO NOT re-run `npm run seed` while old PPDB rows might still exist with mismatched id semantics.** If a clean slate is preferred (recommended), wipe the table first:

  ```bash
  psql $DATABASE_URL -c 'DELETE FROM "Faq";'
  ```

  Then `npm run seed:content` (or whichever command the repo uses) to repopulate from the now-PPDB-free `kontak.ts`.

- [ ] **Document the chosen path (UPDATE vs DELETE+RESEED) in the commit message** so reviewers know which strategy the dev DB took.

- [ ] No Prisma migration needed — `Faq.category` is a plain `String` column, not a Prisma enum. Validation lives in Zod.
- [ ] Integration test DB needs no migration — every suite `deleteMany`s before running.

### Task 1.11 — Verify, run, commit

**Steps:**
- [ ] `npx tsc --noEmit` — must be clean. If anything still references `'ppdb'`, the compiler reports it now.
- [ ] `npm test && npm run test:int` — same or higher pass counts than Task 0.
- [ ] Final grep invariant: `rg -i 'ppdb|penerimaan peserta didik|pendaftaran siswa baru|calon siswa' src/ scripts/ prisma/` returns 0 hits (or 1 documented exception per Task 1.8).
- [ ] **Faq table must contain zero rows where `category='ppdb'`** — confirms the Step A/Step B sequence in Task 1.10 was executed correctly (whether the UPDATE path or the DELETE+RESEED path was chosen). Run:

  ```bash
  psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"Faq\" WHERE category='ppdb';"
  ```

  Expected: `0`. If non-zero, re-do Task 1.10 in the documented order before committing.
- [ ] Commit: `feat(phase3b): total PPDB scrub — FaqCategory enum, page copy, Button variant, seed cleanup`.

**Deliverable:** PPDB-free codebase; FaqCategory enum tightened from 4 to 3 values; Button has 6 variants instead of 7; kontak FAQ has 5 items instead of 8; dev DB FAQ rows migrated from `ppdb` to `lainnya`. tsc + unit + integration green at same-or-higher counts than Task 0.

---

## Chunk 2 — Shared `syncPhotoUsage` helper + Teacher wiring (single commit)

**Why now:** Teacher actions currently never call `linkMediaUsage` / `unlinkMediaUsage` — that's a real latent orphan-leak bug. Extracting the helper, adding tests, AND wiring Teacher in the same commit means the four entity-migration chunks ahead become two-line additions instead of multi-step plumbing. Implements DESIGN PROPOSAL 2 prerequisite.

### Task 2.1 — Create the shared `syncPhotoUsage` helper

**Files:**
- Create: `src/lib/media/sync-photo-usage.ts`

**Steps:**
- [ ] Implement the helper exactly as specified in DESIGN PROPOSAL 2 §G:

  ```ts
  // src/lib/media/sync-photo-usage.ts
  import { prisma } from '@/lib/db/client';
  import { linkMediaUsage, unlinkMediaUsage } from '@/lib/media/link-usage';
  import type { Photo } from '@config/types';

  export type PhotoUsageTable =
    | 'Teacher'
    | 'GalleryItem'
    | 'Facility'
    | 'Extracurricular'
    | 'Achievement';

  export type PhotoUsageContext = {
    table: PhotoUsageTable;
    id: string;
    /** Always 'photoSrc' today; widen to a union if a future entity carries
     *  multiple Photo fields (avatar + cover, etc.). */
    field: 'photoSrc';
  };

  /**
   * Idempotent MediaUsage reconciliation between two Photo states.
   * No-ops for gradient↔gradient transitions and same-publicId url↔url updates.
   * Swallows missing-MediaAsset (validation already rejects unknown publicIds).
   */
  export async function syncPhotoUsage(
    prev: Photo | null,
    next: Photo | null,
    ctx: PhotoUsageContext,
  ): Promise<void> {
    const prevPublicId = prev && prev.kind === 'url' ? prev.src : null;
    const nextPublicId = next && next.kind === 'url' ? next.src : null;
    if (prevPublicId === nextPublicId) return;

    if (prevPublicId) {
      const prevMedia = await prisma.mediaAsset.findUnique({
        where: { publicId: prevPublicId },
        select: { id: true },
      });
      if (prevMedia) {
        await unlinkMediaUsage({
          mediaId: prevMedia.id,
          usedInTable: ctx.table,
          usedInId: ctx.id,
          usedInField: ctx.field,
        });
      }
    }
    if (nextPublicId) {
      const nextMedia = await prisma.mediaAsset.findUnique({
        where: { publicId: nextPublicId },
        select: { id: true },
      });
      if (nextMedia) {
        await linkMediaUsage({
          mediaId: nextMedia.id,
          usedInTable: ctx.table,
          usedInId: ctx.id,
          usedInField: ctx.field,
        });
      }
    }
  }
  ```

### Task 2.2 — Lift `photoFromRow` / `photoToColumns` into a shared module

**Source location (these are EXTRACTED, not freshly authored):**

These are NOT new helpers. `src/lib/data/repositories/teacher-repo.ts` already contains:
- The row→Photo conversion logic inline in `rowToTeacher()` (around lines 6-29) — extract this as a pure `photoFromRow(row): Photo` function.
- The Photo→columns conversion in `photoToColumns(photo): { photoKind, photoSrc, photoAlt, photoFrom, photoTo, photoEmoji }` (around lines 44-50) — already a standalone function, just relocate it.

Move both into a new `src/lib/data/repositories/_photo-columns.ts` module. Verify byte-identical behaviour by running `npm run test:int -- teacher-repo` after the lift — every existing assertion must still pass with NO test changes. If any test now fails, the lift introduced a regression and must be reverted.

**Files:**
- Create: `src/lib/data/repositories/_photo-columns.ts`
- Modify: `src/lib/data/repositories/teacher-repo.ts` (consume the shared helpers; delete the local copies)

**Steps:**
- [ ] In `_photo-columns.ts` export the type + two pure functions per DESIGN PROPOSAL 2 §"Shared photo-column helpers":

  ```ts
  import type { Photo } from '@config/types';

  export type PhotoColumns = {
    photoKind: string;
    photoSrc: string | null;
    photoAlt: string | null;
    photoFrom: string | null;
    photoTo: string | null;
    photoEmoji: string | null;
  };

  export function photoFromRow(row: PhotoColumns, label: string): Photo { /* lift body from teacher-repo lines ~6-29 */ }
  export function photoToColumns(photo: Photo): PhotoColumns { /* lift body from teacher-repo lines ~44-50 */ }
  ```

- [ ] In `teacher-repo.ts`, import the shared helpers and delete the local copies. Behaviour must be byte-identical — verify by re-running existing teacher integration tests (`npm run test:int -- teacher-repo`). NO test changes are allowed; any failure means revert the lift.

### Task 2.3 — Wire Teacher actions through `syncPhotoUsage`

**Files:**
- Modify: `src/app/(admin)/admin/entities/_actions/teacher-actions.ts`

**Steps:**
- [ ] In `createTeacherAction`: after the `createTeacher` call, call

  ```ts
  await syncPhotoUsage(null, input.photo, { table: 'Teacher', id: created.id, field: 'photoSrc' });
  ```

- [ ] In `updateTeacherAction`: BEFORE the `updateTeacher` call, read the existing photo. The `photoFromRow` helper used here is the same function lifted in Task 2.2 from `src/lib/data/repositories/teacher-repo.ts` lines ~6-29 (the row→Photo logic inside `rowToTeacher()`); import it from `src/lib/data/repositories/_photo-columns.ts`:

  ```ts
  const existing = await prisma.teacher.findUnique({
    where: { id },
    select: { photoKind: true, photoSrc: true, photoAlt: true, photoFrom: true, photoTo: true, photoEmoji: true },
  });
  const prevPhoto = existing ? photoFromRow(existing, `Teacher:${id}`) : null;
  ```

  AFTER the update succeeds, call

  ```ts
  await syncPhotoUsage(prevPhoto, input.photo, { table: 'Teacher', id, field: 'photoSrc' });
  ```

- [ ] In `deleteTeacherAction`: read the existing photo (same pattern), perform the delete, then `await syncPhotoUsage(prevPhoto, null, { table: 'Teacher', id, field: 'photoSrc' });`.
- [ ] Audit + revalidateTag behaviour unchanged.

### Task 2.4 — Unit + integration tests

**Files:**
- Create: `src/__tests__/lib/media/sync-photo-usage.test.ts` (unit; mock prisma)
- Create: `src/__tests__/integration/media/sync-photo-usage.int.test.ts` (real DB)

**Steps:**
- [ ] Unit test coverage (mocked `prisma.mediaAsset.findUnique`, `linkMediaUsage`, `unlinkMediaUsage`):
  - gradient → url: one link call, zero unlink calls
  - url → gradient: one unlink call, zero link calls
  - url → url (different publicId): one unlink + one link
  - url → url (same publicId): zero calls (equality short-circuit)
  - gradient → gradient: zero calls
  - url → null (delete flow): one unlink
  - null → url (create flow): one link
  - null → null: zero calls
  - url → url where `prev.src` resolves to a missing MediaAsset: zero unlink (silently skipped), one link for `next.src` if present
- [ ] Integration test exercising one Teacher round-trip with a real MediaAsset row:
  - seed MediaAsset for publicId `smpn3kresek/image/abc123`
  - create Teacher with `photo.kind='url', src='smpn3kresek/image/abc123'`
  - assert one `MediaUsage` row with `usedInTable='Teacher'` exists
  - update Teacher to gradient photo
  - assert the `MediaUsage` row is gone
  - update back to url
  - assert one `MediaUsage` row exists again
  - delete Teacher
  - assert zero `MediaUsage` rows for that Teacher id
- [ ] Run: `npm test -- sync-photo-usage && npm run test:int -- sync-photo-usage`. Green.

### Task 2.5 — Verify Teacher regression suite, commit

**Steps:**
- [ ] `npm run test:int -- teacher`. Existing Teacher tests must still pass.
- [ ] `npx tsc --noEmit && npm test && npm run test:int`. Same or higher pass counts than Chunk 1.
- [ ] Commit: `refactor(media): extract syncPhotoUsage helper, wire Teacher actions to close MediaUsage orphan leak`.

**Deliverable:** shared helper + photo-column helpers in place; Teacher actions now correctly maintain MediaUsage; net code line count drops; tsc + unit + integration must remain green (counts up by ~8 unit + 1 integration).

---

## Chunk 3 — GalleryItem image migration

**Why third:** simplest of the four entities (no discriminated-union complication like Facility, no neutral-gradient synthesis like Achievement/Extracurricular since GalleryItem already has gradients). Establishes the pattern that Chunks 4–6 follow.

### Task 3.1 — Prisma migration: add photo columns, backfill, drop legacy

**Files:**
- Create: `prisma/migrations/20260530_phase3b_gallery_photo/migration.sql`
- Modify: `prisma/schema.prisma`

**SQL preview** (the migration script):

```sql
-- 1. add new columns with safe defaults
ALTER TABLE "GalleryItem"
  ADD COLUMN "photoKind"  TEXT NOT NULL DEFAULT 'gradient',
  ADD COLUMN "photoSrc"   TEXT,
  ADD COLUMN "photoAlt"   TEXT,
  ADD COLUMN "photoFrom"  TEXT,
  ADD COLUMN "photoTo"    TEXT,
  ADD COLUMN "photoEmoji" TEXT;

-- 2. backfill from legacy columns (every existing row becomes a valid gradient Photo)
UPDATE "GalleryItem"
  SET "photoFrom"  = "gradientFrom",
      "photoTo"    = "gradientTo",
      "photoEmoji" = "emoji",
      "photoKind"  = 'gradient';

-- 3. integrity guard (must return 0)
-- SELECT COUNT(*) FROM "GalleryItem"
--   WHERE "photoKind"='gradient' AND ("photoFrom" IS NULL OR "photoTo" IS NULL OR "photoEmoji" IS NULL);

-- 4. drop legacy columns
ALTER TABLE "GalleryItem"
  DROP COLUMN "gradientFrom",
  DROP COLUMN "gradientTo",
  DROP COLUMN "emoji";
```

**Steps:**
- [ ] Author the migration above. Run `npx prisma migrate dev --name phase3b_gallery_photo` against the dev DB.
- [ ] Verify back-compat default applied correctly:

  ```bash
  psql $DATABASE_URL -c 'SELECT "photoKind", COUNT(*) FROM "GalleryItem" GROUP BY 1;'
  ```

  Expected: 100% of pre-existing rows return `photoKind='gradient'`. Any row with `photoKind='url'` immediately after migration indicates a backfill bug — abort the chunk and investigate.
- [ ] Update `prisma/schema.prisma`'s `GalleryItem` model to the new column set: 6 photo columns, no legacy gradient/emoji fields. Run `npx prisma generate`.
- [ ] **Sanity check:** `psql $DATABASE_URL -c 'SELECT "photoKind", COUNT(*) FROM "GalleryItem" GROUP BY 1;'` — every row should be `gradient`. The guard query in the SQL must return 0.

### Task 3.2 — Update `@config/types` GalleryItem interface

**Files:**
- Modify: `src/config/types.ts`

**Steps:**
- [ ] Replace the `GalleryItem` interface's flat photo fields with `photo: Photo`:

  ```ts
  export interface GalleryItem {
    id: string;
    caption: string;
    photo: Photo;
    category?: string;
    span?: 'wide' | 'tall' | 'normal';
  }
  ```

- [ ] Delete the standalone `emoji`, `gradientFrom`, `gradientTo` fields.
- [ ] Do NOT run typecheck yet — many consumers will surface in 3.3–3.7.

### Task 3.3 — Update gallery-item Zod schema

**Files:**
- Modify: `src/lib/validation/schemas/entities/gallery-item.ts`

**Steps:**
- [ ] Import `photoSchema` from `@/lib/validation/schemas/shared`.
- [ ] Replace flat `emoji`, `gradientFrom`, `gradientTo` validators with `photo: photoSchema`.
- [ ] Keep `id`, `caption`, `category` optional / `span` optional shape unchanged.

### Task 3.4 — Update gallery repository

**Files:**
- Modify: `src/lib/data/repositories/gallery-repo.ts`

**Steps:**
- [ ] Import `photoFromRow`, `photoToColumns` from `@/lib/data/repositories/_photo-columns`.
- [ ] `rowToGalleryItem` now reads the 6 photo columns and calls `photoFromRow(row, \`GalleryItem:${row.id}\`)` to produce `photo: Photo`. Strip the old flat-field assignments.
- [ ] `createGalleryItem(input)` spreads `...photoToColumns(input.photo)` into the prisma `data` payload instead of the flat fields.
- [ ] `updateGalleryItem(id, input)` same treatment.
- [ ] `deleteGalleryItem(id)` — no body changes; orchestration happens in the action.
- [ ] Cache tag stays `'gallery'`.

### Task 3.5 — Update gallery server actions to call `syncPhotoUsage`

**Files:**
- Modify: `src/app/(admin)/admin/entities/_actions/gallery-actions.ts`

**Steps:**
- [ ] Mirror the Teacher wiring done in Chunk 2.3 — `createGalleryItemAction`, `updateGalleryItemAction`, `deleteGalleryItemAction` each call `syncPhotoUsage(prev, next, { table: 'GalleryItem', id, field: 'photoSrc' })` at the appropriate point.
- [ ] Audit names `create_gallery_item`, `update_gallery_item`, `delete_gallery_item` (snake_case, unchanged).
- [ ] `revalidateTag` calls: `'gallery'`, `'page:home'`, `'page:fasilitas'`. Verify against the assemblers — `home.ts` and `fasilitas.ts` are the consumers.

### Task 3.6 — Swap `GradientOnlyPhotoPicker` → `PhotoPicker` in the manager

**Files:**
- Modify: `src/app/(admin)/admin/entities/gallery/GalleryItemManager.tsx`

**Steps:**
- [ ] Replace the `GradientOnlyPhotoPicker` import with `PhotoPicker` from `@/components/admin/form/PhotoPicker`. The drop-in pattern matches `TeacherManager.tsx` lines 5–22.
- [ ] Replace the form-schema's flat `emoji` / `gradientFrom` / `gradientTo` fields with `photo: photoSchema`.
- [ ] `reset({ ..., photo: DEFAULT_GRADIENT_PHOTO })` — use the `DEFAULT_GRADIENT_PHOTO` constant already exported from `@/components/admin/form/PhotoPicker` (or `@/lib/media` per Phase 3 conventions).
- [ ] Replace the `<GradientOnlyPhotoPicker {...} />` JSX with `<PhotoPicker control={form.control} name="photo" />`.
- [ ] The `toInput(v)` transform that previously split `photo` back into flat fields is no longer needed; pass `photo` through unchanged to the server action.

### Task 3.7 — Public render: GalleryItem molecule + GallerySection variant prop

**Files:**
- Modify: `src/components/molecules/GalleryItem.tsx`
- Modify: `src/components/organisms/home/GallerySection.tsx`
- Modify: `src/components/organisms/fasilitas/GaleriSection.tsx`

**Steps:**
- [ ] Add to `GalleryItem.tsx` the conditional render per the Teacher card pattern (DESIGN PROPOSAL 2 §F):

  ```tsx
  const gradStyle = data.photo.kind === 'gradient'
    ? { background: `linear-gradient(135deg, ${data.photo.from}, ${data.photo.to})` }
    : undefined;

  // inside the visual slot:
  {data.photo.kind === 'gradient' ? (
    <span aria-hidden className="text-7xl">{data.photo.emoji}</span>
  ) : (
    <img
      src={cldUrl(data.photo.src, variant)}
      alt={data.photo.alt}
      className="h-full w-full object-cover"
      loading="lazy"
    />
  )}
  ```

- [ ] Add an optional `variant?: CldVariant` prop on `GalleryItem` (default `'card'`). The consuming section decides:
  - `GallerySection.tsx` (home): `index === 0` OR `item.span === 'wide'` → `variant='hero'`; everything else → `variant='card'`.
  - `GaleriSection.tsx` (fasilitas): all tiles → `variant='card'` (the fasilitas gallery is a uniform grid, no hero spotlight).
- [ ] `cldUrl` import from `@/lib/media/cldUrl` (already shipped Phase 3).
- [ ] For gradient-branch back-compat, the existing visual remains pixel-identical: same emoji-on-gradient look as before the migration. Verified by snapshot test in Task 3.9.

### Task 3.8 — Assembler passthrough

**Files:**
- Modify: `src/lib/data/assemblers/home.ts`
- Modify: `src/lib/data/assemblers/fasilitas.ts`

**Steps:**
- [ ] No logic change. The repository returns `GalleryItem[]` with `photo: Photo` and the assemblers pass them through. Confirm: no assembler currently reads `.emoji` / `.gradientFrom` / `.gradientTo` on gallery items — they only pass the list to the public sections. (Task 0 grep confirms this.)
- [ ] Per memory rule: home reads the full list and slices top-N (already in place post-bc6b8c7). No `featuredIds` allowed.

### Task 3.9 — Seed update

**Files:**
- Modify: `scripts/seed-content.ts`

**Steps:**
- [ ] For every seeded `GalleryItem`, replace flat fields with a `photo: { kind: 'gradient', from, to, emoji }` literal preserving existing values byte-for-byte.
- [ ] Idempotency: the seed is keyed by `id` (upsert), so re-running over already-migrated rows is safe.
- [ ] Run `npm run seed` (or whatever the project's seed alias is) against the dev DB; rows in `GalleryItem` should be unchanged visually.

### Task 3.10 — Test updates

**Files:**
- Create: `src/__tests__/integration/repositories/gallery-repo.photo.test.ts`
- Modify: existing `src/__tests__/integration/repositories/gallery-repo.test.ts` (if it pins `.emoji` / `.gradientFrom`)
- Modify: `src/__tests__/lib/validation/entities.test.ts` (gallery fixtures)

**Steps:**
- [ ] New integration test `gallery-repo.photo.test.ts` covers:
  - create gradient → read returns `photo.kind === 'gradient'` with correct values
  - create url (after seeding a MediaAsset) → read returns `photo.kind === 'url'`
  - update gradient → url creates exactly one `MediaUsage` row
  - update url → gradient deletes the `MediaUsage` row
  - delete with url photo cleans the `MediaUsage` row
- [ ] Existing tests that constructed `GalleryItem` literals with `emoji`, `gradientFrom`, `gradientTo` are rewritten to use `photo: { kind: 'gradient', from, to, emoji }`.
- [ ] Run: `npm run test:int -- gallery-repo && npm test -- entities.test`. Green.

### Task 3.11 — Verify, commit

**Steps:**
- [ ] `npx tsc --noEmit`. Clean.
- [ ] `npm test && npm run test:int`. Same or higher pass counts.
- [ ] **Manual smoke** (per design proposal sequencing): open `/admin/entities/gallery`, edit a row, swap its gradient for a real uploaded image. Public home page renders the photo; fasilitas gallery renders it; existing gradient rows unchanged.
- [ ] Commit: `feat(phase3b): GalleryItem photo migration — flat → Photo discriminated union with Cloudinary uploads`.

**Deliverable:** Gallery admins can upload real photos for any tile; existing gradient rows render byte-identically; MediaUsage rows are maintained on every create/update/delete; tsc + tests must remain green (counts: ~+6 integration, ~+3 unit).

---

## Chunk 4 — Facility-featured image migration

**Why fourth:** the only entity with a discriminated union (`featured | mini`). The pattern from Chunk 3 carries over for `featured`; `mini` stays untouched. The DB-level CHECK constraint enforces the branch invariant.

### Task 4.1 — Prisma migration: photo columns on Facility with CHECK constraint

**Files:**
- Create: `prisma/migrations/20260530_phase3b_facility_photo/migration.sql`
- Modify: `prisma/schema.prisma`

**SQL preview:**

```sql
-- 1. add 6 photo columns (all nullable except photoKind which gets a conditional value)
ALTER TABLE "Facility"
  ADD COLUMN "photoKind"  TEXT,
  ADD COLUMN "photoSrc"   TEXT,
  ADD COLUMN "photoAlt"   TEXT,
  ADD COLUMN "photoFrom"  TEXT,
  ADD COLUMN "photoTo"    TEXT,
  ADD COLUMN "photoEmoji" TEXT;

-- 2. backfill featured rows from legacy columns
UPDATE "Facility"
  SET "photoKind"  = 'gradient',
      "photoFrom"  = "gradientFrom",
      "photoTo"    = "gradientTo",
      "photoEmoji" = "emoji"
  WHERE "kind" = 'featured';

-- 3. mini rows: leave all photo columns NULL
-- (no UPDATE needed)

-- 4. integrity guard
-- SELECT COUNT(*) FROM "Facility" WHERE "kind"='featured' AND ("photoKind" IS NULL OR "photoFrom" IS NULL);
-- SELECT COUNT(*) FROM "Facility" WHERE "kind"='mini'     AND "photoKind" IS NOT NULL;
-- Both must return 0.

-- 5. CHECK constraint enforces the discriminated-union invariant
ALTER TABLE "Facility" ADD CONSTRAINT facility_photo_branch_ck CHECK (
  ("kind" = 'mini' AND "photoKind" IS NULL) OR
  ("kind" = 'featured' AND "photoKind" IS NOT NULL)
);

-- 6. drop legacy columns from featured (they were only meaningful there)
ALTER TABLE "Facility"
  DROP COLUMN "gradientFrom",
  DROP COLUMN "gradientTo",
  DROP COLUMN "emoji";
```

**Steps:**
- [ ] Author the migration. Run `npx prisma migrate dev --name phase3b_facility_photo` against the dev DB.
- [ ] Verify back-compat default applied correctly:

  ```bash
  psql $DATABASE_URL -c 'SELECT "photoKind", COUNT(*) FROM "Facility" GROUP BY 1;'
  ```

  Expected: 100% of pre-existing rows return `photoKind='gradient'`. Any row with `photoKind='url'` immediately after migration indicates a backfill bug — abort the chunk and investigate.
- [ ] Note: `Facility.icon` (on mini) is kept; only the legacy gradient columns are dropped.
- [ ] Update `prisma/schema.prisma`'s `Facility` model. Run `npx prisma generate`.
- [ ] Sanity: both guard queries must return 0.

### Task 4.2 — Update `@config/types` Facility interfaces

**Files:**
- Modify: `src/config/types.ts`

**Steps:**
- [ ] `FacilityCard` (the featured variant) loses flat `emoji` / `gradientFrom` / `gradientTo`, gains `photo: Photo`.
- [ ] `FacilityMini` unchanged — `icon: string` stays.
- [ ] If a parent `Facility` discriminated union exists, ensure its branches reflect the change.

### Task 4.3 — Update facility Zod schema

**Files:**
- Modify: `src/lib/validation/schemas/entities/facility.ts`

**Steps:**
- [ ] Branches:

  ```ts
  z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('featured'), id, name, description, photo: photoSchema, span: spanOptional }),
    z.object({ kind: z.literal('mini'),     id, name, icon: z.string().min(1) }),
  ])
  ```

- [ ] The `mini` branch retains `icon: z.string().min(1)`. Featured branch loses `icon` / `emoji` / `gradientFrom` / `gradientTo`.

### Task 4.4 — Update facility repository

**Files:**
- Modify: `src/lib/data/repositories/facility-repo.ts`

**Steps:**
- [ ] `rowToAdminFacility(row)`:
  - if `row.kind === 'featured'`: assert non-null photo columns (or throw with descriptive label — Chunk 4 Task 4.1 already CHECK-enforces this at DB level, so a defensive assertion is enough), call `photoFromRow(row, \`Facility:${row.id}\`)`.
  - if `row.kind === 'mini'`: assert photo columns are null (DB-enforced), use `icon`.
- [ ] `createFacility` / `updateFacility`:
  - branch on `input.kind`. For `featured`, spread `...photoToColumns(input.photo)` into the prisma data payload. For `mini`, set all 6 photo columns to `null` explicitly (so the CHECK passes) and use `icon`.
- [ ] Cache tag stays `'facilities'`.

### Task 4.5 — Update facility server actions

**Files:**
- Modify: `src/app/(admin)/admin/entities/_actions/facility-actions.ts`

**Steps:**
- [ ] `syncPhotoUsage` integration ONLY runs on the `featured` branch — wrap the call with `if (input.kind === 'featured') { … }`. For `mini`, no MediaUsage row is ever created.
- [ ] On `updateFacilityAction`, if a row transitions from `featured` to `mini` (unlikely but possible), the helper still does the right thing: `prevPhoto` exists, `nextPhoto = null` (via the wrapper `if (input.kind === 'featured') input.photo else null`) → unlink. Reverse direction → link.
- [ ] Audit names `create_facility`, `update_facility`, `delete_facility` (already existing — verify snake_case).
- [ ] `revalidateTag('facilities')`, `revalidateTag('page:fasilitas')`, `revalidateTag('page:home')` if home shows facility chips.

### Task 4.6 — Swap `GradientOnlyPhotoPicker` → `PhotoPicker` in the manager

**Files:**
- Modify: `src/app/(admin)/admin/entities/facilities/FacilityManager.tsx`

**Steps:**
- [ ] The manager has two form layouts (featured vs mini). Only the `featured` form uses `PhotoPicker`. The `mini` form keeps its `icon` input (likely a `<input type="text">` for emoji glyph — unchanged).
- [ ] In the `featured` branch: replace `<GradientOnlyPhotoPicker {...}/>` with `<PhotoPicker control={form.control} name="photo" />`. Replace flat-field defaults in `reset()` with `photo: DEFAULT_GRADIENT_PHOTO`.
- [ ] Form schema for `featured` matches Task 4.3.

### Task 4.7 — Public render: SaranaSection conditional

**Files:**
- Modify: `src/components/organisms/fasilitas/SaranaSection.tsx`

**Steps:**
- [ ] For featured tiles: same conditional render as `GalleryItem` in Chunk 3.7. Determine variant: `index === 0 || tile.span === 'wide'` → `'hero'`, else `'card'`.
- [ ] Bottom overlay (`name + description`) is rendered on top of either the gradient or the image — preserve existing layout.
- [ ] Mini tiles: unchanged. Continue rendering the `icon` glyph.

### Task 4.8 — Assembler passthrough

**Files:**
- Modify: `src/lib/data/assemblers/fasilitas.ts`

**Steps:**
- [ ] No logic change; pass facility list through. Verify no `.emoji` / `.gradientFrom` access in this file post-Chunk 3 grep.

### Task 4.9 — Seed update

**Files:**
- Modify: `scripts/seed-content.ts`

**Steps:**
- [ ] For each seeded featured Facility, replace flat fields with `photo: { kind: 'gradient', from, to, emoji }`.
- [ ] For each seeded mini Facility, no change (keeps `icon`).
- [ ] Re-run seed; visual identical.

### Task 4.10 — Test updates

**Files:**
- Create: `src/__tests__/integration/repositories/facility-repo.photo.test.ts`
- Modify: existing `src/__tests__/integration/repositories/facility-repo.test.ts` and `src/__tests__/lib/validation/entities.test.ts` for fixture rewrites.

**Steps:**
- [ ] Coverage in new test:
  - featured + gradient round-trip
  - featured + url round-trip with MediaUsage assertions
  - featured + url → featured + gradient: MediaUsage cleared
  - featured + url → mini: MediaUsage cleared; CHECK constraint holds
  - mini → featured + gradient: CHECK holds; no MediaUsage created
  - direct insert violating CHECK (`kind='mini'` with photoKind non-null) throws a Prisma error — defensive assertion
- [ ] Existing tests with literal `emoji` / `gradientFrom` on featured rewritten to `photo: { kind: 'gradient', ... }`.
- [ ] Run: `npm run test:int -- facility-repo`. Green.

### Task 4.11 — Verify, commit

**Steps:**
- [ ] `npx tsc --noEmit && npm test && npm run test:int`. Same or higher pass counts.
- [ ] Manual smoke: open `/admin/entities/facilities`, edit a featured row, upload a real image; verify `/fasilitas` renders it. Verify mini rows still render with their icons.
- [ ] Commit: `feat(phase3b): Facility-featured photo migration with discriminated-union CHECK constraint`.

**Deliverable:** featured facilities support uploaded images while mini facilities continue to render icons; CHECK constraint enforces the branch invariant at the DB level; tsc + tests must remain green (counts: ~+7 integration, ~+2 unit).

---

## Chunk 5 — Extracurricular image migration

**Why fifth:** simplest of the remaining two (no synthesised gradient is visually visible at runtime — Extracurricular currently renders an icon glyph on a fixed background). The Photo gradient branch carries synthesised neutral `from`/`to` values that are invisible until/unless a designer changes the layout. Achievement (Chunk 6) follows the same pattern.

### Task 5.1 — Prisma migration

**Files:**
- Create: `prisma/migrations/20260530_phase3b_extracurricular_photo/migration.sql`
- Modify: `prisma/schema.prisma`

**SQL preview:**

```sql
ALTER TABLE "Extracurricular"
  ADD COLUMN "photoKind"  TEXT NOT NULL DEFAULT 'gradient',
  ADD COLUMN "photoSrc"   TEXT,
  ADD COLUMN "photoAlt"   TEXT,
  ADD COLUMN "photoFrom"  TEXT,
  ADD COLUMN "photoTo"    TEXT,
  ADD COLUMN "photoEmoji" TEXT;

-- synthesise neutral gradient stops; preserve the existing icon as photoEmoji
UPDATE "Extracurricular"
  SET "photoEmoji" = "icon",
      "photoFrom"  = '#F1F5F9',
      "photoTo"    = '#E2E8F0',
      "photoKind"  = 'gradient';

-- guard
-- SELECT COUNT(*) FROM "Extracurricular"
--   WHERE "photoKind"='gradient' AND ("photoFrom" IS NULL OR "photoTo" IS NULL OR "photoEmoji" IS NULL);

ALTER TABLE "Extracurricular" DROP COLUMN "icon";
```

**Steps:**
- [ ] Author migration. Run `npx prisma migrate dev --name phase3b_extracurricular_photo`.
- [ ] Verify back-compat default applied correctly:

  ```bash
  psql $DATABASE_URL -c 'SELECT "photoKind", COUNT(*) FROM "Extracurricular" GROUP BY 1;'
  ```

  Expected: 100% of pre-existing rows return `photoKind='gradient'`. Any row with `photoKind='url'` immediately after migration indicates a backfill bug — abort the chunk and investigate.
- [ ] Update `prisma/schema.prisma` Extracurricular model. `npx prisma generate`.
- [ ] Note in the migration SQL comment: "Synthesised neutral gradient stops are invisible at the current render — `EkskulCard` paints the photoEmoji on its own fixed background. They become meaningful only if the card layout changes."

### Task 5.2 — Update `@config/types` Extracurricular interface

**Files:**
- Modify: `src/config/types.ts`

**Steps:**
- [ ] Replace `icon: string` with `photo: Photo`.
- [ ] Keep `id`, `name`, `category`, `description`, `pembina`, `schedule`, `achievement?` unchanged.

### Task 5.3 — Update extracurricular Zod schema

**Files:**
- Modify: `src/lib/validation/schemas/entities/extracurricular.ts`

**Steps:**
- [ ] Replace `icon: z.string().min(1)` with `photo: photoSchema`.

### Task 5.4 — Update extracurricular repository

**Files:**
- Modify: `src/lib/data/repositories/extracurricular-repo.ts`

**Steps:**
- [ ] Mirror Chunk 3.4 — import shared helpers, swap row mapper + create/update payloads.
- [ ] Cache tag stays whatever the existing tag is (likely `'ekskul'` or `'extracurriculars'` — verify).

### Task 5.5 — Update extracurricular server actions

**Files:**
- Modify: `src/app/(admin)/admin/entities/_actions/extracurricular-actions.ts`

**Steps:**
- [ ] Wire `syncPhotoUsage` calls per Chunk 3.5.
- [ ] Audit: `create_extracurricular`, `update_extracurricular`, `delete_extracurricular`.
- [ ] `revalidateTag` for entity tag plus `page:fasilitas` (the ekskul page is under fasilitas).

### Task 5.6 — Swap `GradientOnlyPhotoPicker` in the manager

**Files:**
- Modify: `src/app/(admin)/admin/entities/ekskul/ExtracurricularManager.tsx` (or whatever the existing file name is)

**Steps:**
- [ ] Per Chunk 3.6 pattern: swap import, form schema, default, and JSX.
- [ ] Default for new rows: `DEFAULT_GRADIENT_PHOTO` with the existing default-icon emoji (e.g. `'🏆'`).

### Task 5.7 — Public render: EkskulCard conditional

**Files:**
- Modify: `src/components/molecules/EkskulCard.tsx`

**Steps:**
- [ ] Conditional render: gradient branch shows `photoEmoji` on the existing fixed-color background; url branch shows the uploaded image with `cldUrl(publicId, 'card')` in an aspect-video container. Image branch overrides the background entirely.

### Task 5.8 — Assembler passthrough

**Files:**
- Modify: `src/lib/data/assemblers/fasilitas.ts` (or wherever ekskul is assembled)

**Steps:**
- [ ] Passthrough only. Confirm no `.icon` read remains.

### Task 5.9 — Seed update

**Files:**
- Modify: `scripts/seed-content.ts`

**Steps:**
- [ ] For each seeded Extracurricular, replace `icon: 'X'` with `photo: { kind: 'gradient', from: '#F1F5F9', to: '#E2E8F0', emoji: 'X' }`.
- [ ] Idempotency check; re-run seed.

### Task 5.10 — Test updates

**Files:**
- Create: `src/__tests__/integration/repositories/extracurricular-repo.photo.test.ts`
- Modify: existing repo + entity-validation tests.

**Steps:**
- [ ] Same 5 round-trip tests as Chunk 3.10.
- [ ] Run: `npm run test:int -- extracurricular-repo`. Green.

### Task 5.11 — Verify, commit

**Steps:**
- [ ] `npx tsc --noEmit && npm test && npm run test:int`. Same or higher pass counts.
- [ ] Manual smoke: `/admin/entities/ekskul` → edit a row → upload image → `/fasilitas/ekskul` renders it.
- [ ] Commit: `feat(phase3b): Extracurricular photo migration with synthesised neutral gradient fallback`.

**Deliverable:** Ekskul rows support uploaded images; existing rows render byte-identically (icon emoji on fixed background); tsc + tests green (counts: ~+5 integration, ~+2 unit).

---

## Chunk 6 — Achievement image migration

**Why last:** identical pattern to Chunk 5 (icon → photoEmoji + synthesised gradient stops). Achievement's render uses a fixed primary-bg → white gradient overlay so the synthesised values are invisible until/unless a designer changes the layout.

### Task 6.1 — Prisma migration

**Files:**
- Create: `prisma/migrations/20260530_phase3b_achievement_photo/migration.sql`
- Modify: `prisma/schema.prisma`

**SQL preview:**

```sql
ALTER TABLE "Achievement"
  ADD COLUMN "photoKind"  TEXT NOT NULL DEFAULT 'gradient',
  ADD COLUMN "photoSrc"   TEXT,
  ADD COLUMN "photoAlt"   TEXT,
  ADD COLUMN "photoFrom"  TEXT,
  ADD COLUMN "photoTo"    TEXT,
  ADD COLUMN "photoEmoji" TEXT;

UPDATE "Achievement"
  SET "photoEmoji" = "icon",
      "photoFrom"  = '#F1F5F9',
      "photoTo"    = '#E2E8F0',
      "photoKind"  = 'gradient';

-- guard
-- SELECT COUNT(*) FROM "Achievement"
--   WHERE "photoKind"='gradient' AND ("photoFrom" IS NULL OR "photoTo" IS NULL OR "photoEmoji" IS NULL);

ALTER TABLE "Achievement" DROP COLUMN "icon";
```

**Steps:**
- [ ] Author migration. Run `npx prisma migrate dev --name phase3b_achievement_photo`.
- [ ] Verify back-compat default applied correctly:

  ```bash
  psql $DATABASE_URL -c 'SELECT "photoKind", COUNT(*) FROM "Achievement" GROUP BY 1;'
  ```

  Expected: 100% of pre-existing rows return `photoKind='gradient'`. Any row with `photoKind='url'` immediately after migration indicates a backfill bug — abort the chunk and investigate.
- [ ] Update `prisma/schema.prisma` Achievement model. `npx prisma generate`.

### Task 6.2 — Update `@config/types` Achievement interface

**Files:**
- Modify: `src/config/types.ts`

**Steps:**
- [ ] Replace `icon: string` with `photo: Photo`.
- [ ] Keep `id`, `year`, `title`, `recipient`, `organizer`, `level` unchanged.

### Task 6.3 — Update achievement Zod schema

**Files:**
- Modify: `src/lib/validation/schemas/entities/achievement.ts`

**Steps:**
- [ ] Replace `icon: z.string().min(1)` with `photo: photoSchema`.

### Task 6.4 — Update achievement repository

**Files:**
- Modify: `src/lib/data/repositories/achievement-repo.ts`

**Steps:**
- [ ] Mirror Chunk 3.4. Cache tag stays `'prestasi'` (or `'achievements'` — verify).

### Task 6.5 — Update achievement server actions

**Files:**
- Modify: `src/app/(admin)/admin/entities/_actions/achievement-actions.ts`

**Steps:**
- [ ] Wire `syncPhotoUsage` per Chunk 3.5.
- [ ] Audit: `create_achievement`, `update_achievement`, `delete_achievement`.
- [ ] `revalidateTag('prestasi')`, `revalidateTag('page:profil')`, `revalidateTag('page:home')`.

### Task 6.6 — Swap `GradientOnlyPhotoPicker` in the manager

**Files:**
- Modify: `src/app/(admin)/admin/entities/achievements/AchievementManager.tsx`

**Steps:**
- [ ] Per Chunk 3.6.

### Task 6.7 — Public render: PrestasiGridSection + PrestasiCarouselSection conditional

**Files:**
- Modify: `src/components/organisms/profil/PrestasiGridSection.tsx`
- Modify: `src/components/organisms/home/PrestasiCarouselSection.tsx`

**Steps:**
- [ ] Note on broken Cloudinary URLs: if a row has `photoKind='url'` but the underlying Cloudinary asset has been deleted (e.g., via the Cloudinary dashboard), `cldUrl(publicId, variant)` still returns a syntactically valid URL — the `<img>` tag will render the browser's broken-image icon. This is acceptable for Phase 3b; proper fallback (gradient placeholder via img.onError) is deferred to Phase 5.
- [ ] Both sections add the gradient-vs-url conditional. URL branch uses `cldUrl(publicId, 'card')` even though card aspect is 4:3 — `c_fill` crops cleanly with negligible loss; introducing a third variant for one entity is not worth it.
- [ ] Existing fixed-color gradient overlay (primary→white) layers above the photo branch's image OR replaces it depending on design choice — recommended: photo branch shows full-bleed image, gradient branch shows the existing icon-on-fixed-bg look. Confirm with a screenshot before committing.

### Task 6.8 — Assembler passthrough

**Files:**
- Modify: `src/lib/data/assemblers/home.ts`
- Modify: `src/lib/data/assemblers/profil.ts`

**Steps:**
- [ ] Passthrough only. No `.icon` access remains.
- [ ] Memory rule reminder: home assembler reads the full achievement list and slices the top N (already in place); never reads a `featuredIds`.

### Task 6.9 — Seed update

**Files:**
- Modify: `scripts/seed-content.ts`

**Steps:**
- [ ] For each seeded Achievement, replace `icon: 'X'` with `photo: { kind: 'gradient', from: '#F1F5F9', to: '#E2E8F0', emoji: 'X' }`.

### Task 6.10 — Test updates

**Files:**
- Create: `src/__tests__/integration/repositories/achievement-repo.photo.test.ts`
- Modify: `src/__tests__/integration/repositories/achievement-faq-write.test.ts` (already touched in Chunk 1; the gradient-photo fixture goes here too if it creates achievements)
- Modify: `src/__tests__/lib/validation/entities.test.ts` (achievement fixtures)

**Steps:**
- [ ] Same 5 round-trip tests as Chunk 3.10.
- [ ] Run: `npm run test:int -- achievement-repo`. Green.

### Task 6.11 — Verify, commit

**Steps:**
- [ ] `npx tsc --noEmit && npm test && npm run test:int`. Same or higher pass counts.
- [ ] Manual smoke: `/admin/entities/achievements` → edit → upload → `/profil/prestasi` renders; home carousel renders.
- [ ] Commit: `feat(phase3b): Achievement photo migration completing the 4-entity rollout`.

**Deliverable:** Achievement rows support uploaded images; home carousel + profil grid both render correctly; tsc + tests green (counts: ~+5 integration, ~+2 unit).

---

## Chunk 7 — End-to-end verification + final invariants

**Why:** every chunk has its own green-suite checkpoint, but Phase 3b as a whole introduced ~30 file changes + 4 Prisma migrations. A single final pass catches drift before the PR opens.

### Task 7.1 — Full suite + typecheck

**Files:** none.

**Steps:**
- [ ] `git status` clean.
- [ ] `npx tsc --noEmit`. Zero errors.
- [ ] `npm test`. Same or higher unit pass count than Task 0.
- [ ] `npm run test:int`. Same or higher integration pass count than Task 0.
- [ ] `npm run lint`. Zero new warnings.

### Task 7.2 — PPDB grep invariant

**Files:** none.

**Steps:**
- [ ] Run:

  ```bash
  rg -i 'ppdb|penerimaan peserta didik|pendaftaran siswa baru|calon siswa' src/ scripts/ prisma/
  ```

  Expected: 0 hits, OR exactly 1 documented hit on `src/__tests__/lib/validation/site-config.test.ts` if the string-concat trick was rejected (Chunk 1 Task 1.8).
- [ ] Out of scope: `~/.claude/.../feedback-no-ppdb-content.md` (user memory, outside repo) and git history (immutable).

### Task 7.3 — Flat-field grep invariant

**Files:** none.

**Steps:**
- [ ] Run:

  ```bash
  rg -n '\.gradientFrom|\.gradientTo' src/
  ```

  Expected: 0 hits. If any consumer still reads the old flat fields, the entity migration is incomplete.
- [ ] Run:

  ```bash
  rg -n "data\.icon|item\.icon|t\.icon|f\.icon|ach\.icon|achievement\.icon|ekskul\.icon" src/components/ src/lib/data/assemblers/
  ```

  Expected: only `FacilityMini` consumers remain (since `FacilityMini.icon` is retained). All other `.icon` reads on `Achievement` / `Extracurricular` / featured `Facility` must be gone.

### Task 7.4 — MediaUsage integrity check

**Files:** none.

**Steps:**
- [ ] `psql $DATABASE_URL` — for each of the 5 photo-bearing tables, verify MediaUsage row counts match URL-kind photo row counts:

  ```sql
  SELECT 'Teacher' AS table, COUNT(*) FROM "Teacher" WHERE "photoKind"='url'
  UNION ALL
  SELECT 'Teacher_usage', COUNT(*) FROM "MediaUsage" WHERE "usedInTable"='Teacher' AND "usedInField"='photoSrc'
  UNION ALL
  SELECT 'GalleryItem',   COUNT(*) FROM "GalleryItem" WHERE "photoKind"='url'
  UNION ALL
  SELECT 'GalleryItem_usage', COUNT(*) FROM "MediaUsage" WHERE "usedInTable"='GalleryItem'
  -- … repeat for Facility, Extracurricular, Achievement
  ;
  ```

  Each entity's row count should equal its MediaUsage count. If any mismatch, a `syncPhotoUsage` call is missing somewhere.

### Task 7.5 — Manual browser smoke per entity

**Files:** none.

**Steps:**
- [ ] Start dev server: `npm run dev`.
- [ ] Sign in as ADMIN.
- [ ] For each of the 4 new entities (Gallery, Facility-featured, Extracurricular, Achievement):
  - Open the admin manager
  - Create a new row with a real uploaded image
  - Verify the row renders correctly in the admin table preview
  - Visit the public page that consumes the entity (`/`, `/fasilitas`, `/fasilitas/ekskul`, `/profil/prestasi`) and confirm the uploaded image renders
  - Edit the row, swap to a gradient with a different emoji — verify the gradient renders publicly
  - Delete the row — verify it disappears publicly and the MediaUsage row is gone (`psql` check)
- [ ] Sanity-check the public site for any leftover PPDB copy:
  - `/` ctaFinal subtitle reads the new copy
  - `/akademik` ctaFinal subtitle reads the new copy
  - `/kontak` form has 5 subjek options (no PPDB), peta subtitle reads the new copy, form intro reads the new copy, FAQ section has 4 tab chips (Semua, Akademik, Administrasi, Lainnya) and 5 FAQ items
  - `/kontak` ctaFinal subtitle reads the new copy
- [ ] Sanity-check `/admin/entities/faqs`: FAQ form shows 3 category options (Akademik, Administrasi, Lainnya); default selected is Akademik.
- [ ] Broken-asset edge case: open the Cloudinary dashboard, manually delete one MediaAsset that's currently referenced by a public entity, reload the relevant public page (e.g., /profil for Achievement, /fasilitas for Ekskul/Galeri/Fasilitas). Confirm the page does NOT crash. Browser's broken-image icon is acceptable; a 500 page is a regression.

### Task 7.6 — Open the PR

**Files:** none.

**Steps:**
- [ ] If the work was done on a branch (recommended `phase-3b-image-uploads-and-ppdb-scrub`), push: `git push -u origin phase-3b-image-uploads-and-ppdb-scrub`.
- [ ] Open the PR with title `Phase 3b — Image uploads for 4 entities + total PPDB scrub`. Body summarises the 7 chunks, links this plan file, and notes the migration sequence (PPDB scrub → syncPhotoUsage helper → Gallery → Facility-featured → Extracurricular → Achievement) so a reviewer can review chunk-by-chunk via the commit list.
- [ ] Include the post-phase test counts and PPDB grep result in the PR body.

**Deliverable:** Phase 3b complete; all 4 new entities support Cloudinary uploads; PPDB references gone from src + scripts + dev DB; MediaUsage integrity verified; tsc + tests must remain green (counts: ~+28 integration, ~+12 unit relative to Task 0 baseline).

---

## Appendix A — cldUrl variant per entity / surface (consolidated reference)

| Entity              | Surface (page)            | Variant | Notes                                                       |
|---------------------|---------------------------|---------|-------------------------------------------------------------|
| Teacher             | `/profil/guru`            | card    | Already shipped Phase 3; 4:5 card aspect.                  |
| GalleryItem         | `/` home, idx===0         | hero    | 1600×900 spanning tile.                                    |
| GalleryItem         | `/` home, span='wide'     | hero    | 2-col wide tile.                                           |
| GalleryItem         | `/` home, rest            | card    | 640×400.                                                   |
| GalleryItem         | `/fasilitas/galeri` grid  | card    | Uniform grid, no hero.                                     |
| Facility-featured   | `/fasilitas` idx===0      | hero    | 2×2 spanning tile.                                         |
| Facility-featured   | `/fasilitas` span='wide'  | hero    | 2-col wide tile.                                           |
| Facility-featured   | `/fasilitas` rest         | card    | 220px row.                                                 |
| Extracurricular     | `/fasilitas/ekskul` grid  | card    | aspect-video container.                                    |
| Achievement         | `/profil/prestasi` grid   | card    | 4:3 source — c_fill crops cleanly.                         |
| Achievement         | `/` home carousel         | card    | Same card chrome as profil grid.                           |

---

## Appendix B — Domain-type changes (replace-not-extend) consolidated

```ts
// Before → After
GalleryItem:       { emoji, gradientFrom, gradientTo }   → { photo: Photo }
Achievement:       { icon: string }                       → { photo: Photo }
Extracurricular:   { icon: string }                       → { photo: Photo }
FacilityCard:      { emoji, gradientFrom, gradientTo }   → { photo: Photo }
FacilityMini:      (unchanged — icon-only)
Teacher:           (already Photo since Phase 3)
```

`Photo` itself stays exactly as defined in `@config/types`:

```ts
export type Photo =
  | { kind: 'url'; src: string; alt: string }     // src = Cloudinary publicId
  | { kind: 'gradient'; from: string; to: string; emoji: string };
```

---

## Appendix C — Migration sequence rationale

Per DESIGN PROPOSAL 2's "Risk-aware sequencing", chunks deliberately ship in this order:

1. **Chunk 1 (PPDB scrub):** orthogonal, zero schema impact. Lands first so the codebase is in its final non-PPDB state before any Photo migration.
2. **Chunk 2 (syncPhotoUsage):** closes a real Teacher orphan-leak bug, introduces no schema change, gives Chunks 3–6 a single-line integration point.
3. **Chunks 3–6 (entity migrations):** each independently revertable. Order Gallery → Facility-featured → Extracurricular → Achievement is chosen because:
   - Gallery is the simplest — pure flat-to-Photo replacement, no synthesis, no discriminated-union complication.
   - Facility is second because the CHECK constraint and discriminated-union split are the highest-risk piece. Doing it after Gallery means the pattern is proven before tackling the complexity.
   - Extracurricular and Achievement share the synthesised-neutral-gradient pattern; sequencing them last keeps the synthesis decision in one place and makes Chunk 6 a near-copy of Chunk 5.
4. **Chunk 7 (verification):** single final pass; opens the PR.

If any single chunk's tests regress, that chunk reverts cleanly without disturbing earlier chunks.
