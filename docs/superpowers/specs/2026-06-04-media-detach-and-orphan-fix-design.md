# Media "Lepaskan" (detach) + Orphan-Usage Fix — Design Spec

**Date:** 2026-06-04
**Status:** Approved (decisions confirmed by user)

## Goal

Two linked problems with media usage tracking:

1. **Orphan MediaUsage (a real bug).** A photo can be reported "still in use" when it
   actually isn't — verified live: `IMG_3770` has `MediaUsage` rows
   `Mading/mading-2/image:0` + `image:1`, but `mading-2.images = []`. Delete is then
   wrongly refused with no way out.
2. **No "detach" affordance.** When delete is (correctly) refused for an in-use photo,
   there is no button to **unmount** the photo from a location. The user can only be
   told "it's used here" — a dead end. The refusal message is also too casual.

Fix both: clean the existing orphans + stop the seed from creating them, and add a
**"Lepaskan"** (detach) action that unmounts a photo from one location (without
deleting the file — deletion is still the separate destroy flow), surfaced in both the
picker dialog and the media library.

## Root cause of the orphan bug (verified)

`scripts/seed-content.ts` Mading block does `prisma.mading.upsert(... update:{ images: [] })`
**directly via Prisma, without calling `syncImageUsages`**. Flow that produced the
live orphans:
1. Admin uploaded a photo to mading-2 via `updateMadingAction` → MediaUsage rows
   `image:0`/`image:1` created correctly.
2. A later reseed (during the MySQL migration / config work) upserted mading-2 back to
   `images: []` straight through Prisma — bypassing `syncImageUsages` → the usage rows
   were never unlinked → **orphans**.

`getMadingById` is NOT cached (plain fn), and `updateMadingAction`/`deleteMadingAction`
sync correctly — so the action paths are fine. The bug is purely the seed bypass.

## Decisions (confirmed)

| Topic | Decision |
|---|---|
| Scope | Fix orphans (clean + prevent) **and** build the detach feature. |
| Detach mechanism | "Lepaskan" returns the location to a safe empty state: single-photo entities → **gradient placeholder**; Mading → **remove that array element**; SectionPhoto → **clear (unset)**; DocumentSlot → **mediaId = null**. After detaching from ALL locations, the photo can be deleted. |
| Orphan-safe | If the location no longer references the photo (orphan), detach simply **removes the stale MediaUsage row**. So "Lepaskan" on an orphan clears it immediately. |
| Button placement | "Lepaskan" appears in **both** the picker dialog usage list AND `/admin/media`'s usage modal. One action, two UIs. |
| Seed fix | Mading seed becomes **create-only** (skip if the row already exists) so it never overwrites admin data / creates orphans. |
| Message tone | Formal: "Foto ini masih digunakan di beberapa lokasi. Lepaskan terlebih dahulu dari setiap lokasi sebelum menghapus." Button label "Lepaskan". |

### Out of scope (YAGNI)

Force-delete from the picker (the admin force-delete on /admin/media already exists),
undo-detach, bulk detach.

## Architecture

### Part 1 — Orphan cleanup + seed fix

**1a. One-time cleanup** of existing orphans. A small idempotent maintenance script
`scripts/cleanup-orphan-usage.ts` (or a direct `prisma db execute`): for every
`MediaUsage` row, check whether its owner still references the photo; delete rows that
don't. For MVP the only known orphans are Mading (`images[idx]` missing) — but the
script should generically handle all tables (see the detach resolver below, reused as a
"does this location still reference this media?" check). Run once against dev; document
running it on prod. Simplest concrete form: delete Mading usage rows whose
`mading.images[parseInt(field)]` is absent (covers the live case); the generic version
is nicer but optional.

**1b. Seed fix** (`scripts/seed-content.ts`): change the Mading `upsert` to **create
only when absent** — e.g. check existence and `create` if missing, OR `upsert` with an
empty `update: {}` so a re-seed never overwrites an existing post's `images`/`title`.
This prevents the seed from ever clobbering admin edits or orphaning usage again.
(`update: {}` is the minimal change and keeps idempotency.)

### Part 2 — Detach action + resolver

**Detach resolver** `src/lib/media/detach-usage.ts` (new) — maps a `UsageRow` (+ the
media's publicId) to "how to unmount", done atomically per detach inside a
`prisma.$transaction`.

**STEP 0 — orphan check FIRST, for EVERY table.** Before any entity write, ask: *does
the owner still reference this `publicId` at this location?* If **NO** (the owner row is
gone, or its photo no longer points here — the live `IMG_3770` case where
`mading.images[N]` is absent), the detach does **only** `tx.mediaUsage.deleteMany({ where:
{ mediaId, usedInTable, usedInId, usedInField } })` and returns. This is what clears the
existing orphans. Only when the owner STILL references the photo do we run the per-table
reset below. (Do NOT lead with `updateMading`/entity writes — they no-op on an orphan
and leave the stale row.)

**STEP 1 — per-table reset (only if the owner still references the photo).** Each branch
does its entity write + the `mediaUsage.deleteMany` **in the SAME `$transaction`** (the
`forceDeleteMediaAction` pattern, media-actions.ts:76-79). Do NOT route through
`syncPhotoUsage`/`unlinkMediaUsage` — those use the global prisma client and cannot
enlist in an external `$transaction`.

| usedInTable | field | "still references?" check | Reset (in tx) |
|---|---|---|---|
| Teacher, Achievement, Extracurricular, GalleryItem | `photoSrc` | row.photoSrc === publicId | `tx.<entity>.update({ where:{id:usedInId}, data: photoToColumns(<defaultGradient>) })` + delete the usage row |
| Facility | `photoSrc` | featured row && photoSrc === publicId | same targeted `photoToColumns(gradient)` update (guard: only featured rows have photoSrc) + delete usage |
| SectionPhoto | parse from `usedInId` (NOT usedInField) | the SectionPhoto row at (pageKey,sectionKey,field) has photoSrc === publicId | `deleteSectionPhoto(pageKey,sectionKey,field)` (new repo fn) + delete usage; render falls back to config gradient |
| Mading | `image:N` | `mading.images[N]?.src === publicId` | read post, splice out index N, `tx.mading.update({ data:{ images } })` + delete usage |
| DocumentSlot | `mediaId` | slot.mediaId === media.id | `tx.documentSlot.update({ where:{id:usedInId}, data:{ mediaId: null } })` + delete usage |
| (unknown table) | — | — | default branch: just delete the usage row so delete is never permanently blocked |

> **SectionPhoto field parse:** `usedInId` is the slot key `home:hero:photo` (built by
> page-section-actions as `${pageKey}:${sectionKey}:${field}`); `usedInField` is the
> literal `'photo'` (NOT the real field). So the resolver derives (pageKey, sectionKey,
> field) from `usedInId.split(':')` — exactly 3 parts (no key contains `:`). The real
> photo field is the 3rd part.

> **defaultGradient** per entity: reuse the manager defaults (Teacher 👤, Gallery 📷,
> Achievement 🏆, etc.) or a single neutral gradient — any valid gradient Photo is fine
> (featured Facility requires a photo; gradient satisfies `facilitySchema`). Build the
> columns with `photoToColumns(gradient)` from `_photo-columns.ts` (verified: produces
> exactly the 10 photo columns these tables share).

> **Why targeted column writes, not full entity re-input:** each `updateX(id, Input)`
> wants the entire `Omit<Entity,'id'>` (and Facility is a discriminated union) —
> reconstructing that just to swap a photo is verbose and fragile. Detaching only
> touches the photo columns, so a focused `tx.<entity>.update({ where:{id}, data:
> photoToColumns(gradient) })` is minimal and correct.

**Action** `detachMediaUsageAction(input)` in
`src/app/(admin)/admin/media/_actions/media-actions.ts` (new export):

```ts
detachMediaUsageAction(input: { mediaId: string } & UsageRow): ActionResult<void>
```
- `withRole(['ADMIN','EDITOR'])`.
- Zod-validate the input (mediaId + usedInTable enum + usedInId + usedInField).
- Resolve the publicId from mediaId (need it to compare against the owner's photoSrc):
  `getMediaAssetById(mediaId)`.
- Call the resolver (the per-table detach above).
- `writeAudit({ action: 'media_detach', target: '<table>:<id>:<field>' })`.
- **Revalidate ALL affected tags** — `revalidateMediaConsumers()` currently misses
  several. After a detach the mutated owner may be any photo-bearing table, so revalidate
  the full set: `media`, `teachers`, `documents`, `section-photos`, **`achievements`,
  `gallery`, `extracurriculars`, `facilities`, `mading`**, and pages
  **`page:home`**, `page:profil`, `page:akademik`, `page:fasilitas`. Simplest: extend
  `revalidateMediaConsumers()` to include the missing tags (it's shared with delete, and
  the extra tags are harmless there) — this also closes a latent gap for the delete path.
  (Per MEMORY "admin CRUD must show on public site", a detached gallery/achievement/mading
  photo MUST refresh on the public site immediately.)
- Returns `{ ok: true }`; the UI then re-queries usage (or removes that row locally).

### Part 3 — UI ("Lepaskan" buttons + formal message)

**Picker** (`ImagePickerModal.tsx`): **the card must keep the RAW usage rows, not just
labels.** The current code does `usage: r.data.usage.map(usageLabel)` into a
`usage?: string[]` — that throws away `usedInTable/usedInId/usedInField` which detach
needs. Change `cardState.usage` to `UsageRow[]` (store `r.data.usage` raw) and render
`usageLabel(row)` at draw time (exactly how MediaManager already stores `usage: UsageRow[]`
and renders `usageLabel(u)`).

The per-card in-use message becomes a small list (one row per usage) each with a
**"Lepaskan"** button. Clicking it calls
`detachMediaUsageAction({ mediaId: m.id, ...usageRow })`; on success, **re-run the
delete attempt** (`deleteMediaAction(m.id)`) which returns the now-shorter usage list
(or `deleted:true` once the last location is detached). So: detach → re-call
`deleteMediaAction` → update the card's usage (raw rows) / remove the card. This keeps
one source of truth (the action's usage result), and re-calling delete is safe — it
refuses (no destroy) while any usage remains.

> NOTE: the picker currently only has `deleteMediaAction`. The usage list it shows
> comes from a refused delete. So the loop is: Hapus → refused (usage list) → Lepaskan
> a row → auto re-attempt delete → either fewer rows or deleted. Each Lepaskan shrinks
> the list until delete succeeds. Display one entry per usage row (already the case),
> each with its own "Lepaskan".

**Media library** (`MediaManager.tsx`): the existing "Berkas masih dipakai" modal lists
usage (now via `usageLabel`). Add a **"Lepaskan"** button per row → `detachMediaUsageAction`
→ on success, refresh the usage list (re-attempt `deleteMediaAction` to recompute, same
pattern) or remove that row from `usageBlock.usage` locally and, when empty, close +
allow delete.

**Formal message:** replace the casual "Lepas dulu dari sana" (picker) and keep
MediaManager's existing "dipakai di N tempat" but reword to the formal sentence:
"Foto ini masih digunakan di beberapa lokasi. Lepaskan terlebih dahulu dari setiap
lokasi sebelum menghapus." Button label: **"Lepaskan"**.

## Data flow (detach loop)

```
Hapus ──▶ deleteMediaAction ──refused──▶ usage[] shown, each row has [Lepaskan]
  Lepaskan(row) ──▶ detachMediaUsageAction({mediaId, ...row})
       resolve publicId; does owner still reference it?
         yes → reset owner's photo (placeholder / remove array elem / null slot) + unlink usage
         no (orphan) → just unlink the stale MediaUsage row
       audit + revalidate
  ──▶ re-attempt deleteMediaAction
       still usage>0 → show shorter list
       usage==0 → destroy Cloudinary + delete row → card/asset removed
```

## Error handling

- Detach of an orphan → unlink only (idempotent; safe to click twice).
- Detach where the owner row is gone entirely → unlink the stale usage; no entity write.
- Detach failure (DB error) → `{ok:false}`, UI shows a formal error; nothing partially
  applied — the entity write + `tx.mediaUsage.deleteMany` run in ONE `$transaction`
  (per STEP 1; do NOT use `syncPhotoUsage` here — global client can't enlist in the tx).
- The usage guard on delete is unchanged: delete still refuses while any usage remains.

## Testing

**Unit (jest):**
- detach resolver mapping: each `usedInTable` → correct operation selection; unknown
  table → no-op/throw; orphan branch (owner no longer references) → unlink-only.
- (usage-label already tested.)

**Integration (jest, real MySQL):**
- Orphan cleanup: seed a Mading post with `images:[]` + a stray MediaUsage row →
  cleanup removes it; a valid usage row is kept.
- Seed create-only: running the seed twice does not overwrite an edited Mading post's
  images / does not recreate removed usage.
- `detachMediaUsageAction`:
  - Mading: post `[A,B]`, detach `image:0` → post becomes `[B]` (or `[null-compacted]`),
    usage `image:0` updated/removed; delete still refused (B remains) then allowed after
    detaching B.
  - Teacher (single photo): detach → teacher.photoKind becomes 'gradient', photoSrc
    null, usage row gone; teacher still valid.
  - SectionPhoto: detach → SectionPhoto row cleared/removed, usage gone.
  - Orphan: usage row with no matching owner reference → detach removes just the row.
  - After detaching all locations, `deleteMediaAction` returns `deleted:true`.

**Build/visual:** `next build`; manual smoke — IMG_3770 now deletable after Lepaskan;
a teacher photo detach returns the teacher to placeholder; multi-location photo needs
each location detached.

## File manifest

**New:**
- `src/lib/media/detach-usage.ts` — the per-table detach resolver
- `src/__tests__/lib/media/detach-usage.test.ts` (if resolver is unit-testable in
  isolation) OR cover via integration
- `src/__tests__/integration/admin/media-detach.test.ts`
- `scripts/cleanup-orphan-usage.ts` — one-time orphan cleanup (idempotent)

**Modify:**
- `src/app/(admin)/admin/media/_actions/media-actions.ts` — add `detachMediaUsageAction`; extend `revalidateMediaConsumers()` with the missing tags (achievements/gallery/extracurriculars/facilities/mading/page:home)
- `src/lib/data/repositories/section-photo-repo.ts` — add `deleteSectionPhoto(pageKey,sectionKey,field)` (no delete fn exists yet)
- `src/components/admin/media/ImagePickerModal.tsx` — store raw `UsageRow[]` (not string[]); per-row "Lepaskan" + detach→re-delete loop + formal copy
- `src/app/(admin)/admin/media/MediaManager.tsx` — per-row "Lepaskan" in the usage modal + formal copy
- `scripts/seed-content.ts` — Mading seed create-only (`update: {}` so reseed never overwrites)

> Seed-scope note: only Mading can orphan usage on reseed — it's the only table whose
> seed overwrites `images` AND whose photos are real admin-uploaded url photos. All other
> entity seeds write gradient placeholders from config (no MediaAsset/MediaUsage created),
> so reseeding them cannot orphan. Mading-only seed fix is correctly scoped.

**Unchanged (verify):** `deleteMediaAction`/`deleteMediaAsset` (delete still refuses
in-use), `cloudinary-destroy`, `usage-label`, `syncPhotoUsage`/`link-usage`, schema (no
migration — detach mutates existing rows + removes MediaUsage via cascade/unlink).

## Risk & mitigation

- **Per-table resolver drift:** a new photo-bearing entity added later won't be
  detachable until added to the resolver. Mitigate: the resolver's table list mirrors
  the `usedInTable` values; add a default branch that at least unlinks the usage row so
  delete isn't permanently blocked.
- **Facility discriminated union:** only featured rows have photos; the targeted column
  write must not corrupt a mini row — guard on the row actually having `photoSrc`.
- **Partial failure:** wrap entity-photo-reset + usage-unlink in a `$transaction`.
- **Idempotency:** detach is safe to repeat (orphan branch unlinks; matched branch
  re-resets to the same placeholder).
- **No schema migration** → low blast radius.
