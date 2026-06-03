# Phase 5 — Admin-Editable Page-Section Photos Design

**Date:** 2026-06-02
**Status:** Draft for approval

## Goal

Let a non-technical school admin replace the photos on the page sections that are NOT one of the 5 CRUD entities — Hero background, Kepala Sekolah (Sambutan), About (×2), Sejarah, Kurikulum — through a new admin editor, reusing the existing PhotoPicker + crop + Cloudinary infra. Until a real photo is uploaded, each section keeps its current gradient/emoji placeholder.

## Product decisions (locked by user)

| Decision | Choice |
|---|---|
| Scope | **Tier B** — all 6 section photos editable (Hero, Sambutan, About main, About sub, Sejarah, Kurikulum) |
| Default state | **Placeholder kept** — sections render today's gradient/emoji until a `photo.kind === 'url'` is set |
| Edit surface | **New `/admin/entities/pages` editor**, reusing PhotoPicker + CropModal |
| Hero style | **Stays a faded background** (photo under the blue gradient overlay, opacity/blend as today) — just swaps the stock Unsplash URL for the school's Cloudinary photo |
| Hero crop frame | **16:9** |

## Per-section crop frame ratios

Frame = the section's real container ratio (so cropper preview = final render).

| Section | Page | Container ratio | Crop frame |
|---|---|---|---|
| Hero (bg) | home | full-width banner | **16:9** |
| Sambutan (kepsek) | home | `aspect-[4/5]` | **4:5** |
| About main | home | `aspect-[4/3]` | **4:3** |
| About sub | home | `aspect-square` | **1:1** |
| Sejarah | profil | `aspect-[5/6]` | **5:6** |
| Kurikulum | akademik | `aspect-[4/3]` | **4:3** |

## Data model

Page-section content already lives in `PageSection` (JSONB, keyed by `pageKey`+`sectionKey`), seeded from `src/config/pages/*.ts`. Seed auto-includes new config fields, so adding a `photo` to a config object flows into the DB on reseed.

**Add an optional `photo: Photo` to each section type** (the same `Photo` discriminated union as entities, with crop). All optional → no migration, no reseed-breaking change; absent `photo` = render placeholder.

Types touched in `src/config/types.ts`:
- `HeroConfig` → add `photo?: Photo`
- `SambutanConfig` → add `photo?: Photo` (keep `photoEmoji`/`photoPlaceholderText` as the placeholder fallback)
- `AboutConfig` → add `photoMain?: Photo` and `photoSub?: Photo` (two images)
- `ProfilePageConfig.sejarah` (inline) → add `photo?: Photo`
- `KurikulumConfig` → add `photo?: Photo`

> No Prisma change — PageSection stores JSONB. No new columns. The photo (incl. crop) is just JSON inside the section's `data`.

## Validation

There are **no per-section Zod schemas today** (page sections are cast, not validated at runtime). We add **minimal Zod schemas only for the photo-bearing field** of each editable section, used by the new write action — NOT a full re-validation of every section field (out of scope, would be a big retrofit). Each schema validates the incoming `{ sectionKey, photo }` patch:

```
pageSectionPhotoPatchSchema = z.object({
  pageKey: z.enum(['home', 'profil', 'akademik']),
  sectionKey: z.enum(['hero', 'sambutan', 'about', 'sejarah', 'kurikulum']),
  field: z.enum(['photo', 'photoMain', 'photoSub']), // about has two
  photo: photoSchema,           // reuse existing — gradient | url + crop
})
```
The action merges the validated photo into the existing section JSON (read-modify-write) so other fields are untouched.

## Storage write path (new)

No `updatePageSection` exists today. Add:
- `src/lib/data/repositories/page-section-repo.ts` → `setPageSectionPhoto(pageKey, sectionKey, field, photo)`: reads the row's JSON, sets the field, writes back, returns the merged section. (Read-modify-write keeps non-photo fields intact.)
- A `getPageSectionsRaw(pageKey)` already effectively exists via `getPageSections`; the editor page reads current photos from it.

## Cloudinary / render

Reuse `cldUrl(publicId, variant, crop)`. Two render shapes:

**A. `<img>` sections (Sambutan, About×2, Sejarah, Kurikulum):** identical to entity pattern — when `photo?.kind === 'url'`, render `<img src={cldUrl(photo.src, variant, cropOf(photo))} className="h-full w-full object-cover">`; else the existing gradient/emoji placeholder. Variant per ratio: 4:5/5:6/1:1 use `card` (crop scales to width, preserving ratio — the Phase 4 fix already does this); a square/portrait crop + `c_scale,w` delivers the right ratio, `object-cover` into the matching container needs no further crop.

**B. Hero (CSS background):** special. Hero sets `style={{ background: "url(...) center/cover" }}` with a gradient overlay + `opacity-25 mix-blend-overlay`. When a hero photo is set, build the Cloudinary URL via `cldUrl(photo.src, 'hero', cropOf(photo))` and inject it into the `url(...)`. The gradient overlay + opacity/blend stay exactly as today (decision: faded background). No `<img>`/`object-cover` here — it's a background string swap. When no photo, keep the current Unsplash URL OR a neutral gradient (decision below in open items — default: keep a tasteful gradient, drop the stranger's stock photo).

## Admin editor (new surface)

**Route:** `/admin/entities/pages` (sits in the existing "Konten" nav group, `roles: ['ADMIN','EDITOR']`).

**UX:** a single page listing the 6 editable photo slots grouped by page (Beranda / Profil / Akademik). Each slot shows: label, current preview (photo or placeholder), and a PhotoPicker bound via react-hook-form `Controller` with the section's `cropAspect`. Saving a slot calls a new `updatePageSectionPhotoAction` → validates → `setPageSectionPhoto` → `syncPhotoUsage` → `revalidateTag('page:<pageKey>')`.

This is NOT the full EntityTable/drawer pattern (there's no list of rows to CRUD) — it's a **fixed set of labeled photo slots**, more like a settings form. Simpler than an entity manager.

**MediaUsage:** call `syncPhotoUsage(prev, next, { usedInTable: 'PageSection', usedInId: '<pageKey>:<sectionKey>:<field>', usedInField: 'photo' })` so uploaded page photos are tracked like entity photos (prevents the media library from thinking they're orphans).

**Action:** `src/app/(admin)/admin/entities/_actions/page-section-actions.ts`, mirroring `gallery-actions.ts` (auth via `withRole`, Zod parse, repo write, syncPhotoUsage, writeAudit, revalidateTag).

## Files touched

**Types/config:** `src/config/types.ts` (5 type edits), `src/config/pages/{home,profil,akademik}.ts` (add `photo` keys — left absent/placeholder by default), `src/config/admin-nav.ts` (1 nav item).
**Validation:** `src/lib/validation/schemas/page-sections/photo-patch.ts` (new).
**Repo/action:** `page-section-repo.ts` (+writer), new `page-section-actions.ts`.
**Render:** `HeroSection.tsx` (bg string), `SambutanSection.tsx`, `AboutSection.tsx`, `SejarahSection.tsx`, `KurikulumSection.tsx` (placeholder → conditional photo).
**Admin UI:** `src/app/(admin)/admin/entities/pages/page.tsx` + `PageSectionPhotoManager.tsx` (new).
**Assemblers:** verify hero/sambutan/about/sejarah/kurikulum pass `photo` through (likely already pass the whole section object — confirm, no-op if so).

## Out of scope (YAGNI)

- Editing non-photo section text (titles, paragraphs) in admin — separate future feature.
- Maps embed (it's an iframe URL, not a photo — different track).
- Decorative gradients, emoji icons, logo — stay hardcoded.
- Full per-section Zod validation of all fields — only the photo patch is validated.
- Removing the legacy `photoEmoji`/`photoPlaceholderText` fields — kept as the fallback placeholder.

## Testing strategy

- **Unit:** the photo-patch Zod schema (accepts gradient/url+crop, rejects bad). `setPageSectionPhoto` merge logic (read-modify-write keeps other keys) — via a repo integration test.
- **Integration:** write a hero photo → read back the section JSON has `photo` with crop; other fields intact.
- **Render:** each section renders placeholder when `photo` absent, and `cldUrl` image when present (component-level or manual).
- **Manual smoke:** upload + crop each of the 6 slots in the new admin editor; verify the public page matches; verify an unset slot still shows the placeholder.

## Risks

- **Hero background blend:** the photo sits under `opacity-25 mix-blend-overlay` + gradient — a school photo will look muted by design (decision: keep faded). Make sure the cropper preview communicates this is a faded background, not a full-bleed image (label it "foto latar").
- **Read-modify-write race:** two admins editing the same section concurrently could clobber. Low risk (tiny admin team); the action re-reads immediately before write. Acceptable for this scale.
- **About has two photos** in one section JSON — the patch `field` enum (`photoMain`/`photoSub`) handles it; ensure the editor exposes both as separate slots.
