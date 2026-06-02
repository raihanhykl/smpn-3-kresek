# Phase 4 — Image Crop & Positioning Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin pan/zoom an uploaded photo inside a per-entity fixed-aspect-ratio frame before submit, persisting a normalized crop region that Cloudinary applies at delivery.

**Architecture:** Extend the existing `Photo` url branch with 4 optional normalized crop fields (`cropX/Y/W/H`, 0–1), thread them through the 6→10 flat DB columns via the shared `_photo-columns.ts` helper, emit a leading `c_crop` segment in `cldUrl`, and mount a `react-easy-crop` modal inside the single shared `PhotoPicker`. All changes are additive/nullable — existing photos render exactly as today.

**Tech Stack:** Next.js 15, React 19, Prisma 6 (Postgres), Zod 3, react-hook-form 7, jest 29, `react-easy-crop@^5.5.7` (new), Cloudinary (string-built URLs).

**Spec:** `docs/superpowers/specs/2026-06-02-phase4-image-crop-positioning-design.md`

---

## Chunk 0: Foundation — type, Zod, cldUrl, DB

This chunk has no UI. It makes crop data representable and renderable. After it, existing photos still render unchanged and a crop (if present) is honored.

### Task 0.1: Extend the Photo type

**Files:**
- Modify: `src/config/types.ts:138-140`

- [ ] **Step 1: Edit the Photo url branch**

Replace:
```ts
export type Photo =
  | { kind: 'url'; src: string; alt: string }
  | { kind: 'gradient'; from: string; to: string; emoji: string };
```
with:
```ts
export type Photo =
  | {
      kind: 'url';
      src: string;
      alt: string;
      // Phase 4: normalized crop region (0–1 fractions of the source image).
      // All four present together = a crop; all absent = render uncropped
      // (legacy/center-fill behaviour). cropW/cropH double as zoom (smaller =
      // more zoomed in).
      //
      // NOTE: this type is a deliberate SUPERSET of what is valid. The real
      // bounds (0–1 range, ≥0.05 size, all-or-nothing, x+w≤1 / y+h≤1) live in
      // `photoSchema` (src/lib/validation/schemas/shared.ts) — Zod is the source
      // of truth. Render-time safety is guaranteed by `cropOf()` in cldUrl.ts,
      // which only returns a crop when all four are present.
      cropX?: number;
      cropY?: number;
      cropW?: number;
      cropH?: number;
    }
  | { kind: 'gradient'; from: string; to: string; emoji: string };
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS (optional fields, no consumer breaks yet).

### Task 0.2: Extend the Zod photo schema

**Files:**
- Modify: `src/lib/validation/schemas/shared.ts:34-43` (the url branch object)
- Test: `src/__tests__/lib/validation/photo.test.ts` (existing — extend)

- [ ] **Step 1: Write failing tests for crop validation**

Add to `src/__tests__/lib/validation/photo.test.ts`:
```ts
it('accepts a url photo with a full crop region', () => {
  expect(photoSchema.safeParse({
    kind: 'url', src: 'smpn3kresek/image/abc', alt: 'x',
    cropX: 0.1, cropY: 0.05, cropW: 0.75, cropH: 0.6,
  }).success).toBe(true);
});

it('accepts a url photo with no crop (legacy)', () => {
  expect(photoSchema.safeParse({
    kind: 'url', src: 'smpn3kresek/image/abc', alt: 'x',
  }).success).toBe(true);
});

it('rejects crop fractions outside 0–1', () => {
  expect(photoSchema.safeParse({
    kind: 'url', src: 'smpn3kresek/image/abc', alt: 'x', cropX: 1.5,
  }).success).toBe(false);
  expect(photoSchema.safeParse({
    kind: 'url', src: 'smpn3kresek/image/abc', alt: 'x', cropW: 0,
  }).success).toBe(false);
});

it('rejects a PARTIAL crop (all-or-nothing invariant)', () => {
  // only cropX + cropW set — must fail (would otherwise reach render half-defined)
  expect(photoSchema.safeParse({
    kind: 'url', src: 'smpn3kresek/image/abc', alt: 'x', cropX: 0.1, cropW: 0.5,
  }).success).toBe(false);
});

it('rejects an OUT-OF-BOUNDS crop region (x+w or y+h > 1)', () => {
  expect(photoSchema.safeParse({
    kind: 'url', src: 'smpn3kresek/image/abc', alt: 'x',
    cropX: 0.8, cropY: 0.1, cropW: 0.5, cropH: 0.2, // 0.8+0.5 = 1.3 > 1
  }).success).toBe(false);
});
```
(If `photo.test.ts` does not exist, create it with `import { photoSchema } from '@/lib/validation/schemas/shared';`)

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- photo.test`
Expected: FAIL (crop fields not in schema yet).

- [ ] **Step 3: Add crop fields + a group refine to the url branch**

In `shared.ts`, the url branch was a bare `z.object({...})` member of the discriminated union. Add the four fields, then attach a `.superRefine()` to the **url object** (NOT the whole union — discriminatedUnion members can carry their own refine). Inside the `z.literal('url')` object (after `alt`):
```ts
    alt: z.string().min(1, 'Alt wajib diisi untuk aksesibilitas'),
    cropX: z.number().min(0).max(1).optional(),
    cropY: z.number().min(0).max(1).optional(),
    cropW: z.number().min(0.05).max(1).optional(), // ≥0.05 — clamp tiny crops
    cropH: z.number().min(0.05).max(1).optional(),
```
Then wrap the url object literal with the group refine (F1 — enforces all-or-nothing + geometric bounds, which the type alone cannot):
```ts
  z.object({
    kind: z.literal('url'),
    src: /* ... unchanged ... */,
    alt: z.string().min(1, 'Alt wajib diisi untuk aksesibilitas'),
    cropX: z.number().min(0).max(1).optional(),
    cropY: z.number().min(0).max(1).optional(),
    cropW: z.number().min(0.05).max(1).optional(),
    cropH: z.number().min(0.05).max(1).optional(),
  }).superRefine((photo, ctx) => {
    const fields = [photo.cropX, photo.cropY, photo.cropW, photo.cropH];
    const present = fields.map((v) => v !== undefined);
    if (present.some(Boolean) && !present.every(Boolean)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom,
        message: 'cropX, cropY, cropW, cropH harus semua ada atau semua kosong' });
      return;
    }
    if (present.every(Boolean)) {
      if (photo.cropX! + photo.cropW! > 1 || photo.cropY! + photo.cropH! > 1) {
        ctx.addIssue({ code: z.ZodIssueCode.custom,
          message: 'Area crop di luar batas: cropX+cropW dan cropY+cropH harus ≤ 1' });
      }
    }
  }),
```
> ⚠️ Verify during execution that `z.discriminatedUnion('kind', [...])` still accepts a member that has `.superRefine()` applied. In Zod 3.25 a refined object is a `ZodEffects` wrapping a `ZodObject`; discriminatedUnion requires the raw `ZodObject` for the discriminator. **If discriminatedUnion rejects the refined member**, fall back to: keep the url member a plain `z.object`, and move the group refine to the OUTER `photoSchema` via `.superRefine()` on the union result, narrowing with `if (photo.kind === 'url')` first. Both are equivalent; pick whichever compiles.

- [ ] **Step 4: Run, verify pass**

Run: `npm test -- photo.test`
Expected: PASS (all 6 cases incl. partial + out-of-bounds rejection).

### Task 0.3: Teach cldUrl to emit a crop segment

**Files:**
- Modify: `src/lib/media/cldUrl.ts:38-43`
- Test: `src/__tests__/lib/media/cldUrl.test.ts` (extend)

- [ ] **Step 1: Write failing tests**

Add to `cldUrl.test.ts`:
```ts
it('prepends a decimal c_crop segment before the variant transform', () => {
  expect(cldUrl('id1', 'card', { x: 0.1, y: 0.05, w: 0.75, h: 0.6 })).toBe(
    `https://res.cloudinary.com/${CLOUD}/image/upload/c_crop,x_0.1,y_0.05,w_0.75,h_0.6/c_fill,w_640,h_400,f_auto,q_auto/id1`,
  );
});

it('is byte-identical to no-crop when crop is omitted', () => {
  expect(cldUrl('id1', 'card')).toBe(cldUrl('id1', 'card', undefined));
});

it('skips the crop segment when crop fields are partial/invalid', () => {
  // @ts-expect-error — deliberately partial
  expect(cldUrl('id1', 'card', { x: 0.1 })).toBe(cldUrl('id1', 'card'));
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- cldUrl.test`
Expected: FAIL (3rd arg not supported).

- [ ] **Step 3: Add the optional crop param**

Replace the `cldUrl` function:
```ts
export type CldCrop = { x: number; y: number; w: number; h: number };

export function cldUrl(
  publicId: string,
  variant: CldVariant = 'original',
  crop?: CldCrop,
): string {
  const cloud = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const { resourceType, transform } = CLD_VARIANTS[variant];
  const base = `https://res.cloudinary.com/${cloud}/${resourceType}/upload`;

  // Crop coordinates are Cloudinary PERCENTAGE-BASED (0–1) fractions:
  // c_crop,x_,y_,w_,h_. Cloudinary requires ALL FOUR to be percentage-based
  // together — we emit all four or none, never mixed with pixel coords. No
  // MediaAsset width/height is needed: the decimals map 1:1 to react-easy-crop's
  // croppedArea fractions. Crop MUST come BEFORE the variant's c_fill (Cloudinary
  // applies chained transforms left-to-right: crop the region first, then fit it
  // to the variant box).
  const cropValid =
    !!crop && [crop.x, crop.y, crop.w, crop.h].every((n) => typeof n === 'number' && Number.isFinite(n));
  const cropSeg = cropValid
    ? `c_crop,x_${crop!.x},y_${crop!.y},w_${crop!.w},h_${crop!.h}`
    : '';

  // F4b — avatar's g_face gravity assumes a full image; once the admin has
  // chosen an explicit crop the focus is already defined, and g_face may fail
  // to find a face in the pre-cropped output. So when a crop is present on the
  // avatar variant, drop g_face (fill the cropped region directly).
  const effectiveTransform =
    cropValid && variant === 'avatar'
      ? transform.replace('g_face,', '')
      : transform;

  const segments = [cropSeg, effectiveTransform].filter(Boolean).join('/');
  return segments ? `${base}/${segments}/${publicId}` : `${base}/${publicId}`;
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test -- cldUrl.test`
Expected: PASS (including all pre-existing cldUrl tests — no regression).

- [ ] **Step 5: Add the avatar+crop test**

Add to `cldUrl.test.ts`:
```ts
it('drops g_face on the avatar variant when a crop is present', () => {
  expect(cldUrl('id1', 'avatar', { x: 0.1, y: 0.1, w: 0.5, h: 0.5 })).toBe(
    `https://res.cloudinary.com/${CLOUD}/image/upload/c_crop,x_0.1,y_0.1,w_0.5,h_0.5/c_fill,w_200,h_200,f_auto,q_auto/id1`,
  );
  // no crop → g_face retained (unchanged behaviour)
  expect(cldUrl('id1', 'avatar')).toBe(
    `https://res.cloudinary.com/${CLOUD}/image/upload/c_fill,g_face,w_200,h_200,f_auto,q_auto/id1`,
  );
});
```
Run: `npm test -- cldUrl.test` → PASS.

### Task 0.4: Thread crop through _photo-columns

**Files:**
- Modify: `src/lib/data/repositories/_photo-columns.ts`
- Test: `src/__tests__/lib/data/photo-columns.test.ts` (create if absent; else extend)

- [ ] **Step 1: Write failing round-trip tests**

Create/extend `src/__tests__/lib/data/photo-columns.test.ts`:
```ts
import { photoFromRow, photoToColumns } from '@/lib/data/repositories/_photo-columns';

describe('_photo-columns crop round-trip', () => {
  it('photoToColumns maps crop fields on url; nulls on gradient', () => {
    expect(photoToColumns({ kind: 'url', src: 'a', alt: 'b', cropX: 0.1, cropY: 0.2, cropW: 0.5, cropH: 0.4 }))
      .toMatchObject({ photoCropX: 0.1, photoCropY: 0.2, photoCropW: 0.5, photoCropH: 0.4 });
    expect(photoToColumns({ kind: 'gradient', from: '#000', to: '#fff', emoji: '🎓' }))
      .toMatchObject({ photoCropX: null, photoCropY: null, photoCropW: null, photoCropH: null });
  });

  it('photoToColumns nulls crop when url photo has no crop', () => {
    expect(photoToColumns({ kind: 'url', src: 'a', alt: 'b' }))
      .toMatchObject({ photoCropX: null, photoCropY: null, photoCropW: null, photoCropH: null });
  });

  it('photoFromRow reconstructs crop only when all four present', () => {
    const withCrop = photoFromRow('GalleryItem', 'g1', {
      photoKind: 'url', photoSrc: 'a', photoAlt: 'b',
      photoFrom: null, photoTo: null, photoEmoji: null,
      photoCropX: 0.1, photoCropY: 0.2, photoCropW: 0.5, photoCropH: 0.4,
    });
    expect(withCrop).toEqual({ kind: 'url', src: 'a', alt: 'b', cropX: 0.1, cropY: 0.2, cropW: 0.5, cropH: 0.4 });

    const noCrop = photoFromRow('GalleryItem', 'g1', {
      photoKind: 'url', photoSrc: 'a', photoAlt: 'b',
      photoFrom: null, photoTo: null, photoEmoji: null,
      photoCropX: null, photoCropY: null, photoCropW: null, photoCropH: null,
    });
    expect(noCrop).toEqual({ kind: 'url', src: 'a', alt: 'b' });
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- photo-columns.test`
Expected: FAIL (PhotoRowColumns lacks crop fields).

- [ ] **Step 3: Extend PhotoRowColumns + both mappers**

In `_photo-columns.ts`:

Add to `PhotoRowColumns`:
```ts
  photoCropX: number | null;
  photoCropY: number | null;
  photoCropW: number | null;
  photoCropH: number | null;
```

In `photoFromRow` url branch, replace the return with:
```ts
    const photo: Photo = { kind: 'url', src: row.photoSrc, alt: row.photoAlt };
    if (
      row.photoCropX !== null && row.photoCropY !== null &&
      row.photoCropW !== null && row.photoCropH !== null
    ) {
      photo.cropX = row.photoCropX;
      photo.cropY = row.photoCropY;
      photo.cropW = row.photoCropW;
      photo.cropH = row.photoCropH;
    }
    return photo;
```

In `photoToColumns` url branch, add (alongside the existing fields):
```ts
      photoCropX: photo.cropX ?? null,
      photoCropY: photo.cropY ?? null,
      photoCropW: photo.cropW ?? null,
      photoCropH: photo.cropH ?? null,
```
In `photoToColumns` gradient branch, add:
```ts
      photoCropX: null,
      photoCropY: null,
      photoCropW: null,
      photoCropH: null,
```

> Note (`exactOptionalPropertyTypes` ON): assigning the optional crop fields on `photo` AFTER construction (as above) avoids the `prop: undefined` problem. Do NOT spread `{ ...photo, cropX: row.photoCropX ?? undefined }`.

- [ ] **Step 4: Run, verify pass**

Run: `npm test -- photo-columns.test`
Expected: PASS.

### Task 0.5: Prisma migration — add 4 crop columns to 5 models

**Files:**
- Modify: `prisma/schema.prisma` (Teacher, Achievement, Extracurricular, GalleryItem, Facility)
- Create: `prisma/migrations/<TS>_phase4_photo_crop/migration.sql`

- [ ] **Step 1: Add columns to schema**

After the `photoEmoji` line in EACH of the 5 models, add:
```prisma
  photoCropX Float?
  photoCropY Float?
  photoCropW Float?
  photoCropH Float?
```

- [ ] **Step 2: Hand-author the migration** (interactive `migrate dev` is blocked in this env)

```bash
TS=$(date +%Y%m%d%H%M%S)
mkdir -p prisma/migrations/${TS}_phase4_photo_crop
```
Write `migration.sql`:
```sql
ALTER TABLE "Teacher"          ADD COLUMN "photoCropX" DOUBLE PRECISION, ADD COLUMN "photoCropY" DOUBLE PRECISION, ADD COLUMN "photoCropW" DOUBLE PRECISION, ADD COLUMN "photoCropH" DOUBLE PRECISION;
ALTER TABLE "Achievement"      ADD COLUMN "photoCropX" DOUBLE PRECISION, ADD COLUMN "photoCropY" DOUBLE PRECISION, ADD COLUMN "photoCropW" DOUBLE PRECISION, ADD COLUMN "photoCropH" DOUBLE PRECISION;
ALTER TABLE "Extracurricular"  ADD COLUMN "photoCropX" DOUBLE PRECISION, ADD COLUMN "photoCropY" DOUBLE PRECISION, ADD COLUMN "photoCropW" DOUBLE PRECISION, ADD COLUMN "photoCropH" DOUBLE PRECISION;
ALTER TABLE "GalleryItem"      ADD COLUMN "photoCropX" DOUBLE PRECISION, ADD COLUMN "photoCropY" DOUBLE PRECISION, ADD COLUMN "photoCropW" DOUBLE PRECISION, ADD COLUMN "photoCropH" DOUBLE PRECISION;
ALTER TABLE "Facility"         ADD COLUMN "photoCropX" DOUBLE PRECISION, ADD COLUMN "photoCropY" DOUBLE PRECISION, ADD COLUMN "photoCropW" DOUBLE PRECISION, ADD COLUMN "photoCropH" DOUBLE PRECISION;
```

- [ ] **Step 3: Apply to dev + test DB + regenerate client**

```bash
npx prisma migrate deploy
DATABASE_URL="postgresql://postgres:raihanhykl@localhost:5432/smpn_3_kresek_pkm_test" npx prisma migrate deploy
npx prisma generate
```

- [ ] **Step 4: Verify columns exist**

```bash
PGPASSWORD=raihanhykl psql -h localhost -U postgres -d smpn_3_kresek_pkm -c '\d "GalleryItem"' | grep photoCrop
```
Expected: 4 rows (photoCropX/Y/W/H, double precision, nullable).

- [ ] **Step 5: Full verify + commit Chunk 0**

```bash
npm run typecheck && npm test && npm run test:int
git add -A && git commit -m "feat(phase4-chunk0): photo crop foundation — type, Zod, cldUrl, columns

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```
Expected: all green; one commit.

---

## Chunk 1: Cropper UI in PhotoPicker

Adds `react-easy-crop`, a crop modal, and the `cropAspect` prop. Wires all 5 managers. After this chunk an admin can adjust + preview, and the crop persists.

### Task 1.1: Install react-easy-crop

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install**

```bash
npm install react-easy-crop@^5.5.7
```

- [ ] **Step 2: Verify it resolved + typecheck still clean**

```bash
npm run typecheck
```
Expected: PASS.

### Task 1.2: CropModal component

**Files:**
- Create: `src/components/admin/form/CropModal.tsx`

- [ ] **Step 1: Write the component**

A client component that wraps `react-easy-crop` in a modal. Props:
```ts
type CropModalProps = {
  publicId: string;          // Cloudinary source to crop (rendered via cldUrl 'original')
  aspect: number;            // locked frame ratio (e.g. 4/5)
  initial?: { x: number; y: number; w: number; h: number }; // normalized, optional
  onConfirm: (crop: { x: number; y: number; w: number; h: number }) => void;
  onCancel: () => void;
};
```
Behavior:
- **Container sizing (CRITICAL — F2):** the element wrapping `<Cropper>` MUST set `position: relative` with an explicit height AND width (e.g. a `relative h-[60vh] w-full` box, or fixed pixels). `react-easy-crop` positions itself `absolute`-ly; inside an unsized/`static` parent it renders blank or oversized. This is the #1 cause of "cropper shows nothing." Use a Tailwind `relative h-[55vh] w-full bg-neutral-900` container.
- Render `<Cropper image={cldUrl(publicId, 'original')} aspect={aspect} crop={crop} zoom={zoom} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_area, areaPercent) => setArea(areaPercent)} />`.
- **onCropComplete signature (F-react):** `(croppedArea, croppedAreaPixels)`. The FIRST arg (`croppedArea`) is **percentage 0–100** with fields `{ x, y, width, height }`. Read the FIRST arg, NOT the pixel one. Convert on confirm: divide each by 100 → 0–1 fractions; map `width→w, height→h`.
- Seed an existing crop: pass `initialCroppedAreaPercentages={{ x: initial.x*100, y: initial.y*100, width: initial.w*100, height: initial.h*100 }}` when `initial` is present (the prop takes 0–100). Confirm this exact prop name exists in v5.5.7 during execution; if renamed, use the version's equivalent.
- **Do NOT export a canvas/blob.** We store coordinates only; the original stays on Cloudinary. No `getCroppedImg`, no canvas, no CORS dance needed.
- Clamp: react-easy-crop keeps the area within the image; the only extra guard is Zod's 0.05 floor + the out-of-bounds refine (Task 0.2). No manual clamp in the modal.
- Modal chrome: dark overlay, "Atur Posisi Foto" title, zoom slider (range 1–3, step 0.1), "Batal" + "Simpan" buttons. Mirror the visual language of `ImagePickerModal.tsx`.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

### Task 1.3: Mount cropper in PhotoPicker UrlFields

**Files:**
- Modify: `src/components/admin/form/PhotoPicker.tsx`

- [ ] **Step 1: Add `cropAspect` to PhotoPickerProps**

```ts
export type PhotoPickerProps = {
  value: Photo;
  onChange: (next: Photo) => void;
  gradientDefaults?: { from: string; to: string; emoji: string };
  urlDefaults?: { src: string; alt: string };
  label?: string;
  disabled?: boolean;
  openImagePicker: OpenImagePicker;
  cropAspect?: number; // when set, UrlFields shows an "Atur Posisi" button locked to this ratio
};
```
Thread `cropAspect` into `<UrlFields ... cropAspect={cropAspect} />`.

- [ ] **Step 2: Update UrlFields**

- Add `cropAspect?: number` to UrlFields props + local `const [cropping, setCropping] = useState(false)`.
- Build the crop arg for the preview:
  ```ts
  const cropArg =
    value.cropX !== undefined && value.cropY !== undefined &&
    value.cropW !== undefined && value.cropH !== undefined
      ? { x: value.cropX, y: value.cropY, w: value.cropW, h: value.cropH }
      : undefined;
  ```
- Preview `<img src={cldUrl(value.src, 'card', cropArg)} ... />` so the thumbnail reflects the crop. Constrain the preview box to `cropAspect` so the admin sees the true frame (e.g. `style={{ aspectRatio: String(cropAspect ?? 1) }}`).
- Add an **"Atur Posisi"** button next to "Ganti Foto", shown only when `value.src && cropAspect`.
- On click → `setCropping(true)`; render `<CropModal>` when `cropping`. On confirm:
  ```ts
  onChange({ ...value, cropX: c.x, cropY: c.y, cropW: c.w, cropH: c.h });
  setCropping(false);
  ```
- When a NEW image is picked (`pickImage`), reset crop: `onChange({ kind:'url', src: picked.publicId, alt: ... })` already drops crop fields — good, a new image starts uncropped.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

### Task 1.4: Pass cropAspect from all 5 managers

**Files:**
- Modify: `src/app/(admin)/admin/entities/teachers/TeacherManager.tsx` (PhotoPicker ~line 178) → `cropAspect={4/5}`
- Modify: `src/app/(admin)/admin/entities/achievements/AchievementManager.tsx` (~179) → `cropAspect={4/3}`
- Modify: `src/app/(admin)/admin/entities/ekskul/ExtracurricularManager.tsx` (~188) → `cropAspect={16/9}`
- Modify: `src/app/(admin)/admin/entities/gallery/GalleryItemManager.tsx` (~165) → `cropAspect={3/2}`
- Modify: `src/app/(admin)/admin/entities/facilities/FacilityManager.tsx` (~193) → `cropAspect={1/1}`

- [ ] **Step 1: Add the prop to each `<PhotoPicker>`**

Each gets one new line, e.g. for Teacher:
```tsx
                <PhotoPicker
                  value={field.value}
                  onChange={field.onChange}
                  openImagePicker={openImagePicker}
                  cropAspect={4 / 5}
                />
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit Chunk 1**

```bash
npm run typecheck && npm test
git add -A && git commit -m "feat(phase4-chunk1): crop UI — react-easy-crop modal in PhotoPicker, wired to 5 managers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Chunk 2: Public render honors crop

Threads the stored crop into every public `cldUrl` call so the site shows what the admin set.

### Task 2.1: Shared crop helper

**Files:**
- Modify: `src/lib/media/cldUrl.ts` (add a tiny extractor) OR inline in each component.

- [ ] **Step 1: Add a helper to cldUrl.ts**

```ts
/** Extract a CldCrop from a url Photo, or undefined if not fully cropped. */
export function cropOf(photo: { cropX?: number; cropY?: number; cropW?: number; cropH?: number }): CldCrop | undefined {
  const { cropX, cropY, cropW, cropH } = photo;
  if (cropX === undefined || cropY === undefined || cropW === undefined || cropH === undefined) return undefined;
  return { x: cropX, y: cropY, w: cropW, h: cropH };
}
```

- [ ] **Step 2: Unit test cropOf**

Add to `cldUrl.test.ts`: full crop → object; missing one → undefined.
Run: `npm test -- cldUrl.test` → PASS.

### Task 2.2: Update the 7 render call-sites

**Files (each: replace the `cldUrl(x.photo.src, 'variant')` with the crop-aware form):**
- `src/components/molecules/TeacherCard.tsx:25` — `cldUrl(data.photo.src, 'card', cropOf(data.photo))`
- `src/components/molecules/GalleryItem.tsx:22` — `cldUrl(photo.src, 'card', cropOf(photo))` (serves BOTH home + fasilitas grids)
- `src/components/molecules/EkskulCard.tsx:23` — `cldUrl(photo.src, 'card', cropOf(photo))`
- `src/components/organisms/profil/PrestasiGridSection.tsx:18` — `cldUrl(a.photo.src, 'card', cropOf(a.photo))`
- `src/components/organisms/home/PrestasiCarouselSection.tsx:29` — `cldUrl(a.photo.src, 'card', cropOf(a.photo))`
- `src/components/organisms/fasilitas/SaranaSection.tsx:38` — `cldUrl(f.photo.src, 'hero', cropOf(f.photo))`
- `src/app/(admin)/admin/entities/gallery/GalleryItemManager.tsx:132` — **F3a** — the admin grid thumbnail uses the `avatar` variant: `cldUrl(g.photo.src, 'avatar', cropOf(g.photo))`. Without this, the admin list thumbnail would ignore the crop the user just set. (Reminder: per Task 0.3 the avatar variant auto-drops `g_face` when a crop is present.)

- [ ] **Step 1: Edit each call-site** (import `cropOf` from `@/lib/media/cldUrl`). Each is already inside a `photo.kind === 'url'` branch per recon, so `cropOf` receives the narrowed url photo.

- [ ] **Step 2: Audit — no missed call-site**

Run: `grep -rn "cldUrl(" src/ | grep -v "test"` and confirm every call rendering an ENTITY user-photo passes a `cropOf(...)` 3rd arg. Deliberately EXCLUDED (leave as-is): the media-library grid in `src/components/admin/media/ImagePickerModal.tsx` (shows pre-crop source assets), the PDF link in `DocumentSlotManager`, and any `original`/`pdf` variant usage. Note any new call-site found that isn't in the list above.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit Chunk 2**

```bash
npm run typecheck && npm test
git add -A && git commit -m "feat(phase4-chunk2): public render applies stored crop via cldUrl(...crop)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Chunk 3: Repo round-trip test + verification

The crop already threads through repos automatically (they use `_photo-columns`). This chunk PROVES it end-to-end and runs the full suite.

### Task 3.1: Integration test — crop persists through gallery repo

**Files:**
- Modify: `src/__tests__/integration/repositories/gallery-write.test.ts`

- [ ] **Step 1: Add a crop round-trip test**

```ts
it('persists and reads back a url photo crop region', async () => {
  const g = await createGalleryItem(input({
    photo: { kind: 'url', src: 'smpn3kresek/image/abc', alt: 'foto',
             cropX: 0.1, cropY: 0.2, cropW: 0.5, cropH: 0.4 },
  }));
  const row = await prisma.galleryItem.findUnique({ where: { id: g.id } });
  expect(row?.photoCropX).toBe(0.1);
  expect(g.photo).toEqual({ kind: 'url', src: 'smpn3kresek/image/abc', alt: 'foto',
                            cropX: 0.1, cropY: 0.2, cropW: 0.5, cropH: 0.4 });
});

it('gradient photo stores null crop columns', async () => {
  const g = await createGalleryItem(input()); // gradient default
  const row = await prisma.galleryItem.findUnique({ where: { id: g.id } });
  expect(row?.photoCropX).toBeNull();
});
```

- [ ] **Step 2: Run, verify pass**

Run: `npm run test:int -- gallery-write`
Expected: PASS (repo needed no change — proves the `_photo-columns` threading).

### Task 3.2: Full suite + reseed sanity

- [ ] **Step 1: Run everything**

```bash
npm run typecheck && npm test && npm run test:int
```
Expected: all green; unit count = prior + new crop tests; integration = prior + 2.

- [ ] **Step 2: Reseed + verify no regression** (seed has no crop data; all photos stay uncropped, columns null)

```bash
npm run db:seed:content
PGPASSWORD=raihanhykl psql -h localhost -U postgres -d smpn_3_kresek_pkm -c 'SELECT count(*) FROM "GalleryItem" WHERE "photoCropX" IS NOT NULL;'
```
Expected: `0` (seed writes no crops; all render as today).

- [ ] **Step 3: Commit Chunk 3**

```bash
git add -A && git commit -m "test(phase4-chunk3): crop round-trip integration test + full-suite green

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Chunk 4: Manual smoke + final

### Task 4.1: Manual smoke per entity (human-driven; agent provides checklist)

- [ ] Teacher (4:5): upload → "Atur Posisi" → pan/zoom → Simpan → preview matches → submit → `/profil` card shows the chosen framing.
- [ ] Achievement (4:3): same flow → `/profil` grid + home carousel match.
- [ ] Extracurricular (16:9): same → `/fasilitas` ekskul card.
- [ ] GalleryItem (3:2): same → home + fasilitas galleries.
- [ ] Facility featured (1:1): same → `/fasilitas` sarana grid (note: wide 2:1 cells auto-fill from the 1:1 crop — verify it looks sane).
- [ ] Existing (pre-crop) photo: open one, confirm it renders uncropped, then re-crop it successfully.

### Task 4.2: Final verification + PR

- [ ] `npm run typecheck && npm run lint && npm test && npm run test:int` all green.
- [ ] Squash-review the chunk commits; open PR `phase-0-foundation → main` (or current working branch) summarizing Phase 4.

---

## Notes for the implementer

- **DRY:** crop threads through ONE helper (`_photo-columns`) and ONE URL builder (`cldUrl`) — do not duplicate crop logic per entity.
- **No regression contract:** every change is additive. A photo with no crop fields must produce a byte-identical `cldUrl` to today. The cldUrl test (Task 0.3 Step 1, "byte-identical") guards this.
- **exactOptionalPropertyTypes ON:** never write `{ cropX: maybeUndefined }` into an object literal typed with required-or-absent optionals; assign after construction or coalesce to `null` for DB columns.
- **react-easy-crop percent convention:** `onCropComplete`'s 2nd arg `croppedAreaPercent` is 0–100; divide by 100 before storing. Verify origin is top-left (it is) on the first real upload during Chunk 1 smoke.
- **Multi-ratio (Galeri/Fasilitas):** only ONE crop is stored; non-reference surfaces `c_fill` the already-cropped region. No per-surface crop. This matches the approved spec.
