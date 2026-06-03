# Mading (Majalah Dinding) — Design Spec

**Date:** 2026-06-03
**Status:** Approved (brainstorm complete, all decisions confirmed by user)

## Goal

Add a school bulletin-board feature ("Mading" / Majalah Dinding) where admins
publish news/info posts. A post is **text-only**, **image-only**, or **text +
images**. Each post may have **multiple images** of **arbitrary aspect ratios**
that must remain fully visible at any ratio. The public page supports **search**
and **sorting**. Posts go live immediately on save.

## Decisions (confirmed with user)

| Topic | Decision |
|---|---|
| Scope | List of news/info posts. No categories, comments, draft/publish. |
| Multi-image storage | **Array in one JSON column** (`images: {src, alt}[]`). Not a relation table. |
| Image display | List card: tidy **16:9 cover** thumbnail. Detail page: **all images whole** (`object-contain`, no cropping). |
| Search | Client-side, matches **title + body**, case-insensitive. |
| Sort | Client-side: **Newest** (default), Oldest, Title A–Z. |
| Publish | **Immediate** — saved post shows on `/mading` at once. |
| Date | **Automatic** from `createdAt`. No manual date field. |
| Body format | **Plain multi-paragraph** text (blank line = new paragraph). No rich text. |
| Title | **Always required** (confirmed). "Image-only" means no body text, but a title is always present — it drives search, A–Z sort, and the detail link. A captionless pure-photo post is intentionally not supported. |
| Crop | **None.** Mading images are flexible-ratio; no crop UI (departs from other entities). |

### Out of scope (YAGNI)

Categories/tags, comments/likes, draft/publish status, rich-text editor, image
cropping, server-side search/pagination, manual post date, image-level cache tags
beyond MediaUsage.

## Architecture

Mading is a standard CRUD entity following the **exact same vertical slice** as
the existing Faq and GalleryItem entities. The only novel parts are (a) the
multi-image JSON column and its `MultiImagePicker` admin component, and (b) the
public list page with client-side search/sort and a whole-image detail page.

Reference patterns (already in the codebase, to be mirrored):
- Repo with `unstable_cache` + cache tags: `src/lib/data/repositories/gallery-repo.ts`
- Zod entity schema: `src/lib/validation/schemas/entities/gallery-item.ts`
- Server actions (`withRole` + audit + `revalidateTag` + `syncPhotoUsage`): `src/app/(admin)/admin/entities/_actions/gallery-actions.ts`
- Admin manager (drawer + react-hook-form + PhotoPicker via `Controller`): `src/app/(admin)/admin/entities/gallery/GalleryItemManager.tsx`
- Media usage tracking: `src/lib/media/sync-photo-usage.ts`, `link-usage.ts`

### 1. Data model — `Mading`

```prisma
model Mading {
  id        String   @id @default(cuid())
  title     String   @db.Text
  body      String?  @db.Text          // multi-paragraph; null/empty = image-only post
  images    Json                        // MadingImage[] : [{ src, alt }]
  order     Int      @default(0)        // reserved for optional manual reorder in admin
  createdAt DateTime @default(now())    // post date + default sort key
  updatedAt DateTime @updatedAt

  @@index([createdAt])
}
```

- `images` is a JSON array of `{ src: <Cloudinary publicId>, alt: <string> }`.
  - **No** gradient / emoji / crop fields — Mading is always real photos at native
    ratio. This is intentionally leaner than the 6-column Photo union.
  - `src` reuses the same publicId validation as `photoSchema.src` (regex
    `^[a-zA-Z0-9_\-/]+$`, rejects `://` and leading `/`).
  - `alt` required (accessibility), `min(1)`.
- Invariant: a post must have **at least one of** non-empty `body` **or** ≥1 image.
  Enforced in the Zod schema via `superRefine`. (No DB CHECK — consistent with the
  app-level-invariant decision made during the MySQL migration.)
- `@db.Text` on `title` and `body` (MySQL: bare String = VARCHAR(191); titles/bodies
  can exceed that — same lesson as the migration).

### 2. Types (`src/config/types.ts`)

```ts
export type MadingImage = { src: string; alt: string };

export type Mading = {
  id: string;
  title: string;
  body?: string | undefined;   // omitted when image-only (explicit |undefined for exactOptionalPropertyTypes)
  images: MadingImage[];
  createdAt: string;           // ISO string (serialized for client components)
};
```

- `body?: string | undefined` — `tsconfig` has `exactOptionalPropertyTypes: true`,
  so optional fields that may be assigned use the explicit `| undefined` form (matches
  `Photo`-bearing types in types.ts, e.g. `photo?: Photo | undefined`). The repo
  assigns `body` conditionally (`if (r.body?.trim()) item.body = r.body`) so it's
  simply omitted when empty.
- **`createdAt` is a NEW pattern, not mirrored.** No existing domain type in
  `config/types.ts` exposes `createdAt`/`updatedAt` — repos strip them. Mading
  deliberately carries `createdAt` (as an ISO string, serialized at the repo
  boundary) because the feature needs a post date for sort + display. This is an
  intentional, justified departure.

### 3. Validation (`src/lib/validation/schemas/entities/mading.ts`)

```ts
import { z } from 'zod';

export const madingImageSchema = z.object({
  src: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z0-9_\-/]+$/, 'src harus berupa Cloudinary publicId')
    .refine((s) => !s.includes('://'), 'src harus publicId, bukan URL')
    .refine((s) => !s.startsWith('/'), 'src tidak boleh dimulai dengan "/"'),
  alt: z.string().min(1, 'Alt wajib diisi untuk aksesibilitas'),
});

export const madingSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1, 'Judul wajib diisi'),
    body: z.string().optional(),
    images: z.array(madingImageSchema).max(20, 'Maksimal 20 gambar'),
  })
  .superRefine((v, ctx) => {
    const hasBody = (v.body ?? '').trim().length > 0;
    if (!hasBody && v.images.length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'Posting harus punya isi teks atau minimal satu gambar',
        path: ['body'],
      });
    }
  });

export type MadingValidated = z.infer<typeof madingSchema>;
```

`madingInputSchema = madingSchema.omit({ id: true })` for create/update actions.

### 4. Repository (`src/lib/data/repositories/mading-repo.ts`)

Mirrors `gallery-repo.ts`:

- `rowToMading(r)` — maps the Prisma row; `images` parsed from JSON with a defensive
  `z.array(madingImageSchema).catch([])` so a malformed column never crashes a read;
  `createdAt` → `r.createdAt.toISOString()`; `body` omitted when null/empty.
- `getAllMading()` — `unstable_cache(..., ['mading', 'all'], { tags: ['mading'] })`,
  ordered `createdAt desc`. Returns `Mading[]`.
- `getMadingById(id)` — **uncached**, returns `Mading | null` (used by detail page +
  actions' prev-state read).
- `createMading(input)` — auto-increment `order` (max+1), `images` stored via
  `JSON` (Prisma `InputJsonValue`), returns mapped domain.
- `updateMading(id, input)` — re-write, return mapped domain.
- `deleteMading(id)` — hard delete.
- (No reorder function in MVP — `order` column exists but list sorts by date. A
  reorder action can be added later without a migration.)

Cache tag: **`'mading'`**. The detail route reads uncached (`getMadingById`) so it's
always fresh; the list reads cached and is revalidated on every write.

### 5. Server actions (`src/app/(admin)/admin/entities/_actions/mading-actions.ts`)

Same shape as gallery actions: `getSession()` → `withRole(['ADMIN','EDITOR'])` →
`madingInputSchema.parse` → repo call → audit → `revalidateTag('mading')` →
per-image `syncPhotoUsage`.

**Multi-image MediaUsage strategy.** Each image slot is tracked with a distinct
`usedInField`:

```ts
const imageRef = (id: string, i: number) => ({
  usedInTable: 'Mading',
  usedInId: id,
  usedInField: `image:${i}`,
});
```

- **create:** for each `i`, `syncPhotoUsage(null, urlPhoto(images[i]), imageRef(id, i))`.
- **update:** diff prev vs next by index. For `i` in `0..max(prevLen, nextLen)-1`,
  `syncPhotoUsage(prevImg[i] ?? null, nextImg[i] ?? null, imageRef(id, i))`. This
  correctly unlinks removed trailing slots and relinks changed ones.
- **delete:** for each prev image `i`, `syncPhotoUsage(prevImg[i], null, imageRef(id, i))`.

`syncPhotoUsage` expects a `Photo | null`; we adapt a `MadingImage` to the url-kind
Photo shape: `{ kind: 'url', src, alt }` (no crop). A tiny local helper
`toUrlPhoto(img): Photo` does this.

> **Index-based slot caveat (documented, accepted):** keying usage by array index
> means reordering images (without changing the set) produces redundant
> unlink+relink churn but stays correct (idempotent link/unlink, unique constraint).
> Orphan detection remains accurate because the union of linked publicIds is correct
> after every write. This is acceptable for MVP; a content-keyed diff is a possible
> later refinement.

Revalidation: `revalidateTag('mading')`. (No page:* tag — Mading is its own page,
not embedded in home/fasilitas. If a "latest mading" teaser is later added to home,
add `revalidateTag('page:home')` then.)

### 6. Admin UI

**`/admin/entities/mading/page.tsx`** — `force-dynamic`, `auth()`,
`getAllMading()`, render `<MadingManager initialItems={...} />` inside `AdminShell`.

**`MadingManager.tsx`** (client) — drawer pattern from `GalleryItemManager`:
- react-hook-form + zodResolver over a form schema `{ title, body, images }`.
- `EntityTable` lists posts (columns: thumbnail of first image / 📷count, title,
  date). Edit / Delete actions. (No reorder UI in MVP.)
- `EntityDrawer` form: title input, body textarea, and the new
  **`MultiImagePicker`** bound via `Controller name="images"`.
- `DeleteConfirmDialog` for delete.
- Submit dispatches create/update action in `startTransition`, then
  `router.refresh()`.
- **Picker must open OUTSIDE `startTransition`** (React 19 defers modal mount
  otherwise — known lesson from Phase 3/4).

**`MultiImagePicker.tsx`** (NEW client component) — the one genuinely new UI piece:
- Props: `{ value: MadingImage[]; onChange: (next: MadingImage[]) => void; openImagePicker: OpenImagePicker; disabled?: boolean }`.
- Renders the current images as an ordered list of rows; each row: small thumbnail
  (`cldUrl(src, 'avatar')`), an `alt` text input (updates that item), a "Hapus"
  button, and up/down reorder buttons (swap with neighbor).
- An "➕ Tambah Gambar" button calls `await openImagePicker({ kind: 'image' })`
  (outside any transition); on a non-null `PickedMedia`, appends
  `{ src: picked.publicId, alt: picked.alt }`.
- No crop button (Mading has no crop). No gradient tab (always url images).
- Empty state: a hint that the post can be image-only or text-only.

**Nav:** add to `src/config/admin-nav.ts` Konten group:
`{ label: 'Mading', href: '/admin/entities/mading', icon: '📰', roles: ['ADMIN', 'EDITOR'] }`
(placed near Galeri).

### 7a. ContentProvider methods (REQUIRED — public pages route through this)

The public list and detail pages consume the `ContentProvider` interface, not the
repo. Add two methods to `src/lib/data/ContentProvider.ts`:

```ts
getMadingList(): Promise<Mading[]>;
getMadingById(id: string): Promise<Mading | null>;
```

Implement in **both** providers:
- `StaticContentProvider.ts` — currently every method reads from `src/config/`.
  Mading has no static config source, so `getMadingList()` returns `[]` and
  `getMadingById()` returns `null` (Mading is a DB-only feature, like nothing in
  the original static seed). This keeps static mode compiling and the page rendering
  an empty state. (Acceptable: the site runs in `api` mode in practice —
  `NEXT_PUBLIC_DATA_SOURCE=api`.)
- `ApiContentProvider.ts` — delegate to the repo: `getMadingList()` →
  `getAllMading()`, `getMadingById(id)` → `getMadingById(id)` (repo fn).

> Verified: `ContentProvider.ts:21-26` is a fixed 6-method interface; both
> `StaticContentProvider` and `ApiContentProvider` implement it. Adding methods
> requires touching all three files — they are added to the file manifest below.

### 7. Public UI

**`/mading/page.tsx`** (server) — follows the **exact public-page pattern** of
`kontak/page.tsx`: `getContentProvider()`, fetch `[site, madingList]` in parallel,
wrap in `<PageLayout site={site} activeRoute="/mading">` (gives navbar + footer
chrome). Renders a `PageHeader` + `<MadingList items={madingList} />`. Page metadata
title "Mading — SMPN 3 Kresek".

> **Public pages do NOT call repos directly.** They go through the
> `ContentProvider` abstraction (`src/lib/data/ContentProvider.ts`) — verified
> against `kontak/page.tsx:16-18` (`const provider = getContentProvider();
> provider.getSiteConfig()` …). Mading must add provider methods (see §7a) and
> wrap the page in `PageLayout` to match every other public page. The admin page,
> by contrast, DOES call the repo directly (`getAllMading()`) — that matches
> `faqs/page.tsx`.

**`MadingList.tsx`** (client) — owns `query` + `sort` state:
- Search `<input>` filters `items` where `title` or `body` contains `query`
  (case-insensitive, `.toLowerCase().includes`).
- Sort `<select>`: Newest (createdAt desc, default), Oldest (asc), Title A–Z
  (localeCompare). Sorting/filtering is pure JS over the already-loaded array.
- Renders a responsive grid of `<MadingCard>`. Empty/no-results state message.

**`MadingCard.tsx`** — list card:
- Thumbnail: first image in a `aspect-[16/9]` `overflow-hidden` frame,
  `cldUrl(img.src, 'card')` + `object-cover`. If no images, a text-only card layout
  (title + body snippet + date, no image frame) or a subtle gradient placeholder
  block — keep it tidy.
- Badge "📷 N" when `images.length > 1`.
- Title, formatted date (id-ID locale, e.g. "3 Juni 2026"), 2–3 line body snippet
  (line-clamp). Whole card links to `/mading/[id]`.

**`/mading/[id]/page.tsx`** (server) — fetch `[site, post]` where
`post = provider.getMadingById(params.id)`; `notFound()` if null. Wrap in
`<PageLayout site={site} activeRoute="/mading">` (detail reuses the `/mading` active
route since `/mading/[id]` is not its own nav entry). Renders title, date, body
(split on blank lines → `<p>` per paragraph, like existing `paragraphs` rendering),
then **all images whole**:
- Each image in a frame: `w-full`, `max-h-[70vh]`, `object-contain`, neutral dark
  background (`bg-neutral-900`) so portrait/narrow images letterbox cleanly.
- `cldUrl(img.src, 'original')` (no `c_fill`, no crop) → native ratio preserved.
- `alt` from the image. Stacked vertically (simple, accessible; no JS carousel in MVP).
- `generateMetadata` sets the post title.

**Public nav link.** This needs THREE coordinated changes — `href` is a closed
`Route` union type, not a free string:

1. `src/config/types.ts` — extend `export type Route` (currently
   `'/' | '/profil' | '/akademik' | '/fasilitas' | '/kontak'`, types.ts:44-49) to add
   `| '/mading'`. Without this, both the nav config and `activeRoute="/mading"` on
   `PageLayout` fail to typecheck.
2. `src/lib/validation/schemas/navigation.ts` — its `href: routeSchema`
   (navigation.ts:7) means `routeSchema` (the Zod mirror of `Route`) must also gain
   `'/mading'`, or the seed's `navigationSchema.parse(rawNav)` throws at runtime.
   Update `routeSchema` to include `/mading`.
3. `src/config/navigation.ts` — add `{ label: 'Mading', href: '/mading' }` after
   "Fasilitas".

Public nav is **DB-backed**: `site-repo.ts` reads `Navigation.items` from the DB at
runtime (NOT the config file). The seed (`seed-content.ts`) upserts `Navigation.items`
from `navigation.ts`, **overwriting** live nav. So after this change, the link appears
only once the seed re-runs (or the `Navigation` DB row is manually updated). Document
this in the implementation: the dev flow is `npm run db:seed:content` to propagate.
Note the upsert clobbers any manual DB nav edits — acceptable here (nav is config-owned).

### 8. cldUrl variant note

- List thumbnail → `card` variant (640px, `c_fill` 16:9 box — fine, it's a deliberate
  cover crop for grid tidiness).
- Detail whole image → `original` variant (`f_auto,q_auto`, no fill). **No `cropOf`**
  — Mading images carry no crop fields.
- Admin row thumbnail → `avatar` variant (small square preview is fine for the editor
  list).

### 9. Seed

`scripts/seed-content.ts`: add a `Mading` seed block creating ~3 example posts
(one text-only, one image-only using existing seeded Cloudinary publicIds if any,
one text+images). Idempotent (`upsert` by a stable id or skip-if-any-exist). Keep it
minimal — these are demo rows the school will replace.

> If there are no real seeded Cloudinary publicIds available, seed image-bearing
> examples with empty `images: []` + body text, and leave a comment, rather than
> referencing publicIds that 404. Prefer correctness over demo richness.

## Data flow

```
Admin create/edit  ──▶ madingAction (withRole, Zod, repo, syncPhotoUsage, audit)
                                          │ revalidateTag('mading')
                                          ▼
public /mading (server) ──▶ getAllMading() [unstable_cache tag 'mading']
                                          ▼
                         MadingList (client: search + sort over array)
                                          ▼
                         MadingCard ──link──▶ /mading/[id] (getMadingById, whole images)
```

## Error handling

- Repo reads defend against malformed `images` JSON (`z.array(...).catch([])`).
- Detail route `notFound()` on unknown id.
- Actions return typed `ActionResult` via `withRole` (Zod first-message on invalid,
  P2025 → not_found).
- `syncPhotoUsage` failures are non-fatal to the user action (wrapped like existing
  entities — usage tracking is best-effort, the post still saves). Match the existing
  gallery action's error posture exactly.

## Testing

**Unit (jest, jsdom):**
- `mading.ts` schema: title required; body-or-image invariant (reject empty-empty;
  accept text-only; accept image-only); image src validation (reject URL, reject
  leading `/`, accept publicId); alt required; max-20 images.
- `MadingList` filtering/sorting logic (pure function extracted or component test):
  search matches title and body; each sort order correct.

**Integration (jest, real MySQL test DB):**
- `mading-repo`: create → getAll (ordered desc) → getById → update (images change) →
  delete. Assert `images` round-trips through the JSON column intact.
- `mading-actions` (or repo-level): MediaUsage rows created per image on create;
  removed on delete; diffed correctly on update (add image, remove image, swap).
  Assert orphan accounting via the existing media-usage assertions pattern.

**Build/visual:** `next build` green; manual smoke of `/mading`, `/mading/[id]`,
and `/admin/entities/mading`.

## File manifest

**New:**
- `prisma/migrations/<ts>_add_mading/migration.sql` (generated)
- `src/lib/data/repositories/mading-repo.ts`
- `src/lib/validation/schemas/entities/mading.ts`
- `src/app/(admin)/admin/entities/_actions/mading-actions.ts`
- `src/app/(admin)/admin/entities/mading/page.tsx`
- `src/app/(admin)/admin/entities/mading/MadingManager.tsx`
- `src/components/admin/form/MultiImagePicker.tsx`
- `src/app/mading/page.tsx` (public list — `getContentProvider()` + `PageLayout`)
- `src/app/mading/[id]/page.tsx` (public detail — provider + `PageLayout` + `notFound`)
- `src/components/.../MadingList.tsx` (client: search + sort)
- `src/components/.../MadingCard.tsx`
- Tests: `src/__tests__/lib/validation/mading.test.ts`,
  `src/__tests__/integration/repositories/mading-write.test.ts`,
  `src/__tests__/components/.../mading-list.test.tsx`

> No `assemblers/mading.ts` — the public page wraps `PageLayout` + a single
> `MadingList`; there's no multi-source assembly to do. The provider method returns
> the repo result directly. (Assemblers exist for pages that stitch PageSections +
> entities; Mading is a standalone page.)

**Modified:**
- `prisma/schema.prisma` (+`Mading` model)
- `src/config/types.ts` (+`Mading`, `MadingImage` types; **extend `Route` union with `/mading`**)
- `src/lib/data/ContentProvider.ts` (+`getMadingList`, `getMadingById` interface methods)
- `src/lib/data/StaticContentProvider.ts` (return `[]` / `null` — DB-only feature)
- `src/lib/data/ApiContentProvider.ts` (delegate to repo)
- `src/lib/validation/schemas/navigation.ts` (extend `routeSchema` with `/mading`)
- `src/config/admin-nav.ts` (+Mading entry)
- `src/config/navigation.ts` (+public Mading link)
- `scripts/seed-content.ts` (+Mading seed block)
