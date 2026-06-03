# Phase 4 — Image Crop & Positioning Design

**Date:** 2026-06-02
**Status:** Draft for approval

## Goal

Let an admin pan/zoom an uploaded photo inside a fixed-aspect-ratio frame **before submit**, so they see and control exactly how it will appear on the public site — eliminating the surprise auto-crop. The crop frame's aspect ratio matches each entity's real frontend container ratio.

## Product decisions (locked by user)

| Decision | Choice |
|---|---|
| Crop storage | **Normalized coords** (`x`, `y`, `zoom`) in DB; original image untouched on Cloudinary; transform applied at delivery. Reversible, re-editable, storage-cheap. |
| Existing photos | **Default center-crop** (unchanged render today). Re-editable anytime. No forced migration. |
| Frame ratio control | **Locked per-entity.** User only pans + zooms within the entity's ratio. No free-aspect. |
| Multi-ratio entities | **Crop to dominant ratio; other surfaces auto-fill** from the same focal point via Cloudinary. |
| Edit frame for multi-ratio | Galeri → **3:2**, Fasilitas → **1:1** (most-frequent ratio as the reference frame). |
| Cropper library | **`react-easy-crop`** (~15KB, self-hosted, no Cloudinary UI coupling — preserves handover portability). |

## Entity → crop frame ratio

| Entity | Public render | Crop frame |
|---|---|---|
| Teacher | 4:5 portrait (`TeacherCard.tsx:13`) | **4:5** |
| Achievement | 4:3 (grid + carousel, both agree) | **4:3** |
| Extracurricular | 16:9 (`EkskulCard.tsx:19`, `aspect-video`) | **16:9** |
| GalleryItem | fluid-height landscape grids (home 180px, fasilitas 200px) | **3:2** (dominant landscape) |
| Facility (featured) | mixed 1:1 / 2:1 / 2×2 cells | **1:1** (majority cell) |

Multi-ratio entities (Galeri, Fasilitas): the user crops once at the reference frame. The stored focal point + zoom defines a crop region on the source; each public surface then runs its own `c_fill` against that **pre-cropped** region, so non-reference cells fill sensibly from the same focus instead of an arbitrary center.

## Data model

Crop lives only on the `url` branch of `Photo` (gradient branch irrelevant).

**Stored shape — normalized fractions (0–1):**
```ts
// url branch of Photo
{ kind: 'url'; src: string; alt: string;
  cropX?: number;   // 0–1 — left edge of crop region as fraction of source width
  cropY?: number;   // 0–1 — top edge of crop region as fraction of source height
  cropW?: number;   // 0–1 — crop region width as fraction of source width
  cropH?: number;   // 0–1 — crop region height as fraction of source height
}
```

**Why `x/y/w/h` (region) not `x/y/zoom` (focal+zoom):** a normalized rectangle is exactly what `react-easy-crop` outputs (`croppedAreaPercent`) and exactly what Cloudinary's `c_crop` consumes after converting to pixels. Zoom is implicit in `w/h` (smaller w/h = more zoomed in). One representation, no conversion math, no ambiguity. All four optional → existing rows render unchanged.

**Insertion points (all additive, nullable — no backfill):**
1. **Type** — `src/config/types.ts` `Photo` url member gains `cropX?/cropY?/cropW?/cropH?`.
2. **DB** — `prisma/schema.prisma`: add nullable `photoCropX/Y/W/H Float?` to Teacher, Achievement, Extracurricular, GalleryItem, Facility. One migration.
3. **Zod** — `src/lib/validation/schemas/shared.ts` url branch: `cropX/Y/W/H: z.number().min(0).max(1).optional()`.
4. **Row mapper** — `src/lib/data/repositories/_photo-columns.ts`: extend `PhotoRowColumns` + `photoFromRow` (url branch reads crop) + `photoToColumns` (url writes crop, gradient writes null).

## Cloudinary transform

**Conflict (confirmed):** every variant in `cldUrl.ts` bakes `c_fill,...` first. A crop chained *after* fill would crop the resized output. Crop must come **first** (Cloudinary applies transforms left-to-right).

**Recipe:**
```
c_crop,x_<px>,y_<px>,w_<px>,h_<px>/<variant-transform>/<publicId>
```
e.g. card with crop:
```
c_crop,x_120,y_60,w_900,h_600/c_fill,w_640,h_400,f_auto,q_auto/<publicId>
```

**`cldUrl` signature change:**
```ts
cldUrl(publicId, variant, crop?: { x: number; y: number; w: number; h: number })
// crop values are normalized 0–1; cldUrl converts to px using source dims.
```
- Crop absent → byte-identical to today (no regression).
- **Source dimensions:** `MediaAsset.width/height` already stored (`schema.prisma:271-272`). Normalized→pixel conversion happens at URL-build time. The render component passes the crop fractions from the `Photo` object; the source dims are resolved from the photo's MediaAsset (via `cldUrl` using percentage-based crop so dims aren't even needed at the cldUrl layer — Cloudinary accepts decimal `w_0.5` etc.).

**Refinement — use Cloudinary decimal crop to avoid needing source pixels at render:** Cloudinary supports fractional crop (`c_crop,x_0.1,y_0.05,w_0.75,h_0.6`) interpreted relative to source. This means `cldUrl` can take the normalized fractions directly and emit them as decimals — **no MediaAsset dimension lookup needed at render time.** This keeps `cldUrl` pure (no DB dependency) and edge/RSC-safe as today. Stored fractions map 1:1 to the URL.

## UX integration

Single integration point: **`UrlFields` inside `PhotoPicker.tsx`** (the static preview at lines 164-175). All 5 managers already use this one `PhotoPicker` and bind `photo` via `Controller`, so the crop data rides the existing `field.value`/`field.onChange` for free once the type + Zod allow it.

**New prop:** `PhotoPicker` gains `cropAspect: number` (e.g. `4/5`, `4/3`, `16/9`, `3/2`, `1/1`). Each manager passes its entity's ratio.

**Flow:**
1. User picks image → `onChange({ kind:'url', src, alt })` (as today).
2. `UrlFields` shows the preview. New **"Atur Posisi"** (Adjust Position) button opens a modal with `react-easy-crop` locked to `cropAspect`.
3. User pans + zooms; on **"Simpan"**, `react-easy-crop`'s `croppedAreaPercent` (already 0–1) maps directly to `{cropX, cropY, cropW, cropH}` → `onChange({ ...value, cropX, cropY, cropW, cropH })`.
4. Preview re-renders via `cldUrl(src, 'card', crop)` showing the cropped framing.
5. Form submit persists crop through the existing Controller → action → repo → DB path.

**Existing photos:** no crop fields → "Atur Posisi" still works (opens with default full-frame); until edited, public render is today's center `c_fill`.

## Public render changes

Each public component that renders a url photo passes the crop to `cldUrl`:
```ts
cldUrl(photo.src, 'card', photo.kind === 'url' ? cropOf(photo) : undefined)
```
where `cropOf` returns `{x,y,w,h}` when all four are present, else `undefined`. Components touched: `TeacherCard`, `GalleryItem` (home + fasilitas grids), `EkskulCard`, `PrestasiGridSection`, `PrestasiCarouselSection`, `SaranaSection`, plus the admin `UrlFields` preview.

## Out of scope (YAGNI)

- Rotate / filters / brightness (cropper does pan+zoom only).
- Re-cropping existing photos in bulk (per-decision: on-demand only).
- Free-aspect cropping (locked per entity by decision).
- Per-surface independent crops for multi-ratio entities (single crop + auto-fill by decision).

## Testing strategy

- **Unit:** `cldUrl` with/without crop emits correct transform order (crop before fill); crop absent = unchanged. Zod accepts valid crop, rejects out-of-range. `photoFromRow`/`photoToColumns` round-trip crop on url, null on gradient.
- **Integration:** repo create/update persists + reads back crop for one entity (Gallery as canonical); gradient rows keep crop null.
- **Manual smoke:** per entity — upload, adjust position, verify preview matches, submit, verify public render matches the chosen framing; verify an un-cropped existing photo still renders.

## Risks

- `react-easy-crop` `croppedAreaPercent` convention vs Cloudinary decimal crop — verify the coordinate origin (both top-left, both 0–1) in the first task with a real upload.
- Cloudinary decimal `c_crop` rounding on very small regions — clamp `cropW/cropH` to a sane min (e.g. ≥0.05) in the cropper config.
