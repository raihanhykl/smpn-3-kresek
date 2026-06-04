# Media Detach ("Lepaskan") + Orphan Fix — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Clean existing orphan MediaUsage rows + stop the Mading seed creating them, and add a `detachMediaUsageAction` ("Lepaskan") that unmounts a photo from one location (per `usedInTable`), surfaced in the picker dialog and the media library.

**Architecture:** A per-table detach resolver (`detach-usage.ts`) that, inside one `$transaction`, resets the owner's photo reference (entity→gradient, Mading→remove array elem, SectionPhoto→delete row, DocumentSlot→null) and deletes the MediaUsage row — with an **orphan-first** guard (if the owner no longer references the photo, just delete the stale usage row). A `detachMediaUsageAction` wraps it (withRole + Zod + audit + revalidate-all). Both UIs (picker + MediaManager) show a "Lepaskan" button per usage row and re-attempt delete after detaching.

**Spec:** `docs/superpowers/specs/2026-06-04-media-detach-and-orphan-fix-design.md`

**Conventions:** exactOptionalPropertyTypes + noUncheckedIndexedAccess ON; lint `--max-warnings=0`; jest. Server actions importable into client components (MediaManager/ImagePickerModal already do).

**Key verified facts:**
- All photo-bearing entity tables (Teacher, Achievement, Extracurricular, GalleryItem, Facility) share photo columns: `photoKind/photoSrc/photoAlt/photoFrom/photoTo/photoEmoji/photoCropX/Y/W/H`. `photoToColumns(gradient)` from `_photo-columns.ts` produces exactly these.
- `getMadingById` is NOT cached (plain fn) → resolver reads fresh `images`.
- SectionPhoto `usedInId` = slot key `pageKey:sectionKey:field` (split ':' → 3 parts; no key contains ':'). `usedInField` is the literal `'photo'` — parse the real field from `usedInId`.
- `getMediaAssetById(id)` returns `{ publicId, kind, ... }`. Entity `photoSrc === MediaAsset.publicId` (Phase 3 rule).
- `forceDeleteMediaAction` (media-actions.ts:76-79) shows the `$transaction(async tx => { tx.mediaUsage.deleteMany; ... })` pattern to mirror. `syncPhotoUsage`/`unlinkMediaUsage` use the GLOBAL client — do NOT use them inside a `$transaction`.

---

## Task 1: Orphan cleanup script + Mading seed create-only

**Files:**
- Create: `scripts/cleanup-orphan-usage.ts`
- Modify: `scripts/seed-content.ts` (Mading block)

- [ ] **Step 1: Write the cleanup script** (`scripts/cleanup-orphan-usage.ts`)

Generic, idempotent: for each MediaUsage row, resolve whether the owner still
references the photo; delete rows that don't. Covers the live Mading case + future.

```ts
/* eslint-disable no-console */
// One-time (idempotent) cleanup of orphan MediaUsage rows — usage records whose
// owner no longer references the photo (e.g. a Mading post reseeded to images:[]).
// Safe to run repeatedly. Run on dev + prod once after deploy.
import { prisma } from '../src/lib/db/client';

async function main() {
  const rows = await prisma.mediaUsage.findMany();
  const orphanIds: string[] = [];
  for (const u of rows) {
    const media = await prisma.mediaAsset.findUnique({ where: { id: u.mediaId }, select: { publicId: true } });
    if (!media) { orphanIds.push(u.id); continue; } // media gone → cascade should've removed, but be safe
    const pid = media.publicId;
    let referenced = false;
    switch (u.usedInTable) {
      case 'Teacher': case 'Achievement': case 'Extracurricular': case 'GalleryItem': case 'Facility': {
        const tbl = u.usedInTable[0]!.toLowerCase() + u.usedInTable.slice(1); // teacher, achievement, ...
        // @ts-expect-error dynamic delegate access by table name
        const row = await prisma[tbl].findUnique({ where: { id: u.usedInId }, select: { photoSrc: true } });
        referenced = !!row && row.photoSrc === pid;
        break;
      }
      case 'Mading': {
        const m = await prisma.mading.findUnique({ where: { id: u.usedInId }, select: { images: true } });
        const imgs = (m?.images as Array<{ src: string }> | null) ?? [];
        const idx = Number.parseInt(u.usedInField.replace('image:', ''), 10);
        referenced = !!imgs[idx] && imgs[idx]!.src === pid;
        break;
      }
      case 'SectionPhoto': {
        const [pageKey, sectionKey, field] = u.usedInId.split(':');
        if (pageKey && sectionKey && field) {
          const sp = await prisma.sectionPhoto.findUnique({
            where: { pageKey_sectionKey_field: { pageKey, sectionKey, field } },
            select: { photoSrc: true },
          });
          referenced = !!sp && sp.photoSrc === pid;
        }
        break;
      }
      case 'DocumentSlot': {
        const slot = await prisma.documentSlot.findUnique({ where: { id: u.usedInId }, select: { mediaId: true } });
        referenced = !!slot && slot.mediaId === u.mediaId;
        break;
      }
      default:
        referenced = true; // unknown table — keep, don't risk deleting a real usage
    }
    if (!referenced) orphanIds.push(u.id);
  }
  if (orphanIds.length === 0) { console.log('No orphan MediaUsage rows.'); }
  else {
    await prisma.mediaUsage.deleteMany({ where: { id: { in: orphanIds } } });
    console.log(`Removed ${orphanIds.length} orphan MediaUsage row(s):`, orphanIds);
  }
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
```

> The `prisma[tbl]` dynamic access needs the `@ts-expect-error`; if lint forbids it,
> use an explicit switch with the named delegates (prisma.teacher / prisma.achievement
> / …) instead. Prefer the explicit version if cleaner.

- [ ] **Step 2: Run the cleanup against dev DB**

Run: `npm run db:seed:content` is NOT this — run the script directly:
`npx tsx scripts/cleanup-orphan-usage.ts`
Expected: "Removed 2 orphan MediaUsage row(s)" (the two mading-2 rows). Re-run → "No orphan".

- [ ] **Step 3: Make the Mading seed create-only** (`scripts/seed-content.ts`)

Find the Mading `prisma.mading.upsert` and change `update: { title, body, images, order }`
to `update: {}` so a reseed never overwrites an existing post's images (which would
re-orphan usage). Add a comment explaining why.

- [ ] **Step 4: Verify seed idempotency**

Run: `npm run db:seed:content` twice. Expected: no error; an existing Mading post's
images are NOT overwritten (the seed only creates missing rows now).

- [ ] **Step 5: Commit**

```bash
git add scripts/cleanup-orphan-usage.ts scripts/seed-content.ts
git commit -m "fix(media): clean orphan MediaUsage + Mading seed create-only"
```

---

## Task 2: Detach resolver

**Files:**
- Create: `src/lib/data/repositories/section-photo-repo.ts` — ADD `deleteSectionPhoto`
- Create: `src/lib/media/detach-usage.ts`
- Test: `src/__tests__/integration/admin/media-detach.test.ts` (resolver is DB-bound → integration-test it via the action in Task 3; OR a focused resolver integration test here)

- [ ] **Step 0: Extract the Mading usage reconciler to a shared module.** The
  `syncImageUsages` helper currently lives privately in `mading-actions.ts`. Move it to
  `src/lib/media/mading-usage.ts` as `reconcileMadingImageUsages(madingId, prev, next)`
  (same body: loop `Math.max(prev,next)` calling `syncPhotoUsage(toUrlPhoto(prev[i]),
  toUrlPhoto(next[i]), { usedInTable:'Mading', usedInId:madingId, usedInField:`image:${i}` })`).
  Update `mading-actions.ts` to import + use it (replace the local copy). The detach
  resolver imports the same. This guarantees detach reindexes Mading usage identically to
  the admin Mading editor. Run `npm run test:int -- mading` after to confirm the move
  didn't regress the existing Mading action tests.

- [ ] **Step 1: Add `deleteSectionPhoto` to `section-photo-repo.ts`**

```ts
/** Remove a section photo slot entirely (unset → render falls back to config gradient). */
export async function deleteSectionPhoto(
  pageKey: string,
  sectionKey: string,
  field: PhotoField,
): Promise<void> {
  await prisma.sectionPhoto.deleteMany({
    where: { pageKey, sectionKey, field },
  });
}
```
(Use `deleteMany` not `delete` so it's a no-op when the row is absent — idempotent.)

- [ ] **Step 2: Implement the detach resolver** (`src/lib/media/detach-usage.ts`)

```ts
import { prisma } from '@/lib/db/client';
import type { Prisma } from '@prisma/client';
import { photoToColumns } from '@/lib/data/repositories/_photo-columns';
import type { Photo } from '@config/types';

export type UsageRow = { usedInTable: string; usedInId: string; usedInField: string };

// Neutral gradient placeholder for entity photos detached to "empty".
const PLACEHOLDER: Photo = { kind: 'gradient', from: '#DBEAFE', to: '#93C5FD', emoji: '🖼️' };

const ENTITY_TABLES = new Set(['Teacher', 'Achievement', 'Extracurricular', 'GalleryItem', 'Facility']);

/**
 * Unmount a photo (publicId) from ONE location. ORPHAN-FIRST: if the owner no longer
 * references this publicId, only the stale MediaUsage row is removed. Otherwise the
 * owner's photo reference is reset (entity→gradient, Mading→remove elem, SectionPhoto→
 * delete slot, DocumentSlot→null) AND the usage row deleted, in ONE $transaction.
 * Returns 'detached' | 'unlinked-orphan' | 'noop'.
 */
export async function detachMediaUsage(
  publicId: string,
  mediaId: string,
  row: UsageRow,
): Promise<'detached' | 'unlinked-orphan' | 'noop'> {
  const where = { mediaId, usedInTable: row.usedInTable, usedInId: row.usedInId, usedInField: row.usedInField };

  if (ENTITY_TABLES.has(row.usedInTable)) {
    // photoSrc read is union-safe (all 5 delegates share it); the orphan check is shared.
    const ent = await entityFindPhotoSrc(row.usedInTable, row.usedInId);
    if (!ent || ent.photoSrc !== publicId) {
      const del = await prisma.mediaUsage.deleteMany({ where });
      return del.count > 0 ? 'unlinked-orphan' : 'noop';
    }
    // MANDATORY explicit switch — a UNION of the 5 delegates does NOT typecheck on
    // .update() (divergent UpdateInput overloads) under this repo's strict TS. Each case
    // resets the same 10 photo columns + deletes the usage row in ONE $transaction.
    const cols = photoToColumns(PLACEHOLDER);
    const usageDelete = prisma.mediaUsage.deleteMany({ where });
    switch (row.usedInTable) {
      case 'Teacher':
        await prisma.$transaction([prisma.teacher.update({ where: { id: row.usedInId }, data: cols }), usageDelete]); break;
      case 'Achievement':
        await prisma.$transaction([prisma.achievement.update({ where: { id: row.usedInId }, data: cols }), usageDelete]); break;
      case 'Extracurricular':
        await prisma.$transaction([prisma.extracurricular.update({ where: { id: row.usedInId }, data: cols }), usageDelete]); break;
      case 'GalleryItem':
        await prisma.$transaction([prisma.galleryItem.update({ where: { id: row.usedInId }, data: cols }), usageDelete]); break;
      case 'Facility':
        await prisma.$transaction([prisma.facility.update({ where: { id: row.usedInId }, data: cols }), usageDelete]); break;
    }
    return 'detached';
  }

  if (row.usedInTable === 'Mading') {
    // Mading usage rows are keyed by ARRAY INDEX (`image:${i}`). Splicing the array
    // reindexes siblings, so we must reconcile ALL of the post's usage rows, not just
    // delete one — exactly what updateMadingAction does. We therefore reuse that path:
    // splice the array, write it, and re-run the full per-index syncImageUsages diff.
    // (syncPhotoUsage uses the global prisma client → NOT inside a $transaction; that's
    // fine, it's the same proven non-transactional path the admin Mading editor uses.)
    const m = await prisma.mading.findUnique({ where: { id: row.usedInId }, select: { images: true } });
    const prevImgs = ((m?.images as Array<{ src: string; alt: string }> | null) ?? []);
    const idx = Number.parseInt(row.usedInField.replace('image:', ''), 10);
    if (!m || !prevImgs[idx] || prevImgs[idx]!.src !== publicId) {
      // Orphan: post gone, or that slot no longer holds this photo. syncImageUsages
      // would no-op (e.g. prev=[] next=[]), so unlink the stale row directly.
      const del = await prisma.mediaUsage.deleteMany({ where });
      return del.count > 0 ? 'unlinked-orphan' : 'noop';
    }
    const nextImgs = prevImgs.filter((_, i) => i !== idx);
    await prisma.mading.update({
      where: { id: row.usedInId },
      data: { images: nextImgs as unknown as Prisma.InputJsonValue },
    });
    // Reconcile every index: the per-index diff relinks shifted siblings AND unlinks
    // the trailing slot. Verified correct for the middle-removal case:
    //   prev [A,B,C] → next [A,C]:  i0 A→A noop · i1 B→C relink (image:1 now C) ·
    //   i2 C→undefined unlink (image:2 removed)  ⇒ final A@0, C@1 — matches [A,C]. ✓
    // This is EXACTLY syncImageUsages from mading-actions.ts. Extract that helper to a
    // shared module (e.g. src/lib/media/mading-usage.ts: `reconcileMadingImageUsages(id,
    // prev, next)`) and import it in BOTH mading-actions.ts (replacing the local copy)
    // and here. Do NOT hand-roll a separate splice+single-delete — that desyncs sibling
    // image:N rows (the bug this fix prevents). syncPhotoUsage uses the global client,
    // so this runs OUTSIDE the $transaction above (acceptable — same as the Mading editor).
    await reconcileMadingImageUsages(row.usedInId, prevImgs, nextImgs);
    return 'detached';
  }

  if (row.usedInTable === 'SectionPhoto') {
    const [pageKey, sectionKey, field] = row.usedInId.split(':');
    if (!pageKey || !sectionKey || !field) {
      const del = await prisma.mediaUsage.deleteMany({ where });
      return del.count > 0 ? 'unlinked-orphan' : 'noop';
    }
    const sp = await prisma.sectionPhoto.findUnique({
      where: { pageKey_sectionKey_field: { pageKey, sectionKey, field } },
      select: { photoSrc: true },
    });
    if (!sp || sp.photoSrc !== publicId) {
      const del = await prisma.mediaUsage.deleteMany({ where });
      return del.count > 0 ? 'unlinked-orphan' : 'noop';
    }
    await prisma.$transaction([
      prisma.sectionPhoto.deleteMany({ where: { pageKey, sectionKey, field } }),
      prisma.mediaUsage.deleteMany({ where }),
    ]);
    return 'detached';
  }

  if (row.usedInTable === 'DocumentSlot') {
    const slot = await prisma.documentSlot.findUnique({ where: { id: row.usedInId }, select: { mediaId: true } });
    if (!slot || slot.mediaId !== mediaId) {
      const del = await prisma.mediaUsage.deleteMany({ where });
      return del.count > 0 ? 'unlinked-orphan' : 'noop';
    }
    await prisma.$transaction([
      prisma.documentSlot.update({ where: { id: row.usedInId }, data: { mediaId: null } }),
      prisma.mediaUsage.deleteMany({ where }),
    ]);
    return 'detached';
  }

  // Unknown table → never permanently block delete: drop the usage row.
  const del = await prisma.mediaUsage.deleteMany({ where });
  return del.count > 0 ? 'unlinked-orphan' : 'noop';
}

// Union-safe READ only (photoSrc exists on all 5). The .update() must NOT be called on
// a union delegate (won't typecheck) — that's why the branch above uses an explicit
// per-table switch.
async function entityFindPhotoSrc(table: string, id: string): Promise<{ photoSrc: string | null } | null> {
  switch (table) {
    case 'Teacher': return prisma.teacher.findUnique({ where: { id }, select: { photoSrc: true } });
    case 'Achievement': return prisma.achievement.findUnique({ where: { id }, select: { photoSrc: true } });
    case 'Extracurricular': return prisma.extracurricular.findUnique({ where: { id }, select: { photoSrc: true } });
    case 'GalleryItem': return prisma.galleryItem.findUnique({ where: { id }, select: { photoSrc: true } });
    case 'Facility': return prisma.facility.findUnique({ where: { id }, select: { photoSrc: true } });
    default: return null;
  }
}
```

> IMPLEMENTER NOTE (verified by adversarial review): you MUST use the explicit per-table
> `switch` for the `.update()` calls — a single union delegate does NOT typecheck on
> `.update()` in this repo (divergent `UpdateInput` overloads, strict TS). The read
> (`findUnique select:{photoSrc:true}`) IS union-safe and is factored into
> `entityFindPhotoSrc`. `photoToColumns(PLACEHOLDER)` returns the 10 photo columns as a
> plain object; it is individually assignable to each entity's update `data`. If a
> single `cols` object trips a strict-update-type check, type it `satisfies
> Prisma.TeacherUpdateInput` per case or apply one localized cast — avoid `any`. Drop the
> unused `Prisma.InputJsonObject` import if not needed.

- [ ] **Step 3: tsc + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errors / 0 warnings. (The resolver is exercised by Task 3's integration test;
no standalone unit test since it's DB-bound.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/data/repositories/section-photo-repo.ts src/lib/media/detach-usage.ts
git commit -m "feat(media): per-table detach resolver (orphan-first, transactional)"
```

---

## Task 3: detachMediaUsageAction + integration tests

**Files:**
- Modify: `src/app/(admin)/admin/media/_actions/media-actions.ts`
- Test: `src/__tests__/integration/admin/media-detach.test.ts`

- [ ] **Step 1: Write the failing integration test** (`src/__tests__/integration/admin/media-detach.test.ts`)

Mock auth + next/cache (mirror media-delete.test.ts). Seed a MediaAsset + the owner row
+ a MediaUsage row, then assert detach behavior. Cover: Mading detach (remove elem),
Mading ORPHAN (images already empty → stale row removed — the live bug), Teacher detach
(photo→gradient), SectionPhoto detach (row removed), and that after detaching all
locations `deleteMediaAction` returns `deleted:true`.

```ts
import { prisma } from '@/lib/db/client';
import { createMediaAsset } from '@/lib/data/repositories/media-repo';

const mockSession = { user: { id: 'media-detach-test', role: 'ADMIN' as const } };
jest.mock('@/lib/auth/session', () => ({ getSession: jest.fn(async () => mockSession) }));
jest.mock('next/cache', () => ({
  unstable_cache: <T extends (...a: unknown[]) => unknown>(fn: T) => fn,
  revalidateTag: jest.fn(),
  revalidatePath: jest.fn(),
}));
jest.mock('@/lib/media/cloudinary-destroy', () => ({
  destroyCloudinaryAsset: jest.fn(async () => 'destroyed' as const),
}));

import { detachMediaUsageAction, deleteMediaAction } from '@/app/(admin)/admin/media/_actions/media-actions';

function mediaInput(seed: number) {
  const hex = seed.toString(16).padStart(64, '0');
  const pid = `smpn3kresek/image/detach-${seed}`;
  return {
    kind: 'image' as const, url: `https://res.cloudinary.com/c/image/upload/v1/${pid}`,
    publicId: pid, hash: hex, alt: null, filename: `f${seed}`, sizeBytes: 1, mimeType: 'image/jpeg',
    width: null, height: null, uploadedBy: 'seed',
  };
}
const usageCount = (mediaId: string) => prisma.mediaUsage.count({ where: { mediaId } });

describe('detachMediaUsageAction', () => {
  const cleanupIds: string[] = [];
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { id: 'media-detach-test' } });
    await prisma.user.create({ data: { id: 'media-detach-test', email: 'mdt2@test.local', passwordHash: 'x', name: 'MDT2', role: 'ADMIN' } });
  });
  afterAll(async () => {
    await prisma.mediaUsage.deleteMany({ where: { usedInTable: { in: ['Mading', 'Teacher'] }, usedInId: { startsWith: 'detach-' } } });
    await prisma.mading.deleteMany({ where: { id: { startsWith: 'detach-' } } });
    await prisma.teacher.deleteMany({ where: { id: { startsWith: 'detach-' } } });
    await prisma.mediaAsset.deleteMany({ where: { id: { in: cleanupIds } } });
    await prisma.auditLog.deleteMany({ where: { userId: 'media-detach-test' } });
    await prisma.user.deleteMany({ where: { id: 'media-detach-test' } });
    await prisma.$disconnect();
  });

  it('Mading: detaches an image, removing it from the post + the usage row', async () => {
    const m = await createMediaAsset(mediaInput(901)); cleanupIds.push(m.id);
    await prisma.mading.create({ data: { id: 'detach-m1', title: 'T', images: [{ src: m.publicId, alt: 'a' }] as object, order: 0 } });
    await prisma.mediaUsage.create({ data: { mediaId: m.id, usedInTable: 'Mading', usedInId: 'detach-m1', usedInField: 'image:0' } });
    const r = await detachMediaUsageAction({ mediaId: m.id, usedInTable: 'Mading', usedInId: 'detach-m1', usedInField: 'image:0' });
    expect(r.ok).toBe(true);
    expect(await usageCount(m.id)).toBe(0);
    const post = await prisma.mading.findUnique({ where: { id: 'detach-m1' } });
    expect((post!.images as unknown[]).length).toBe(0);
    // now deletable
    const del = await deleteMediaAction(m.id);
    expect(del.ok && del.data.deleted).toBe(true);
  });

  it('Mading ORPHAN (post already empty) → removes the stale usage row (the live bug)', async () => {
    const m = await createMediaAsset(mediaInput(902)); cleanupIds.push(m.id);
    await prisma.mading.create({ data: { id: 'detach-m2', title: 'T', images: [] as object, order: 0 } });
    await prisma.mediaUsage.create({ data: { mediaId: m.id, usedInTable: 'Mading', usedInId: 'detach-m2', usedInField: 'image:1' } });
    const r = await detachMediaUsageAction({ mediaId: m.id, usedInTable: 'Mading', usedInId: 'detach-m2', usedInField: 'image:1' });
    expect(r.ok).toBe(true);
    expect(await usageCount(m.id)).toBe(0);
  });

  it('Teacher: detach resets the photo to gradient + removes usage', async () => {
    const m = await createMediaAsset(mediaInput(903)); cleanupIds.push(m.id);
    await prisma.teacher.create({ data: { id: 'detach-t1', name: 'X', position: 'p', badge: 'b', category: 'guru', photoKind: 'url', photoSrc: m.publicId, photoAlt: 'a' } });
    await prisma.mediaUsage.create({ data: { mediaId: m.id, usedInTable: 'Teacher', usedInId: 'detach-t1', usedInField: 'photoSrc' } });
    const r = await detachMediaUsageAction({ mediaId: m.id, usedInTable: 'Teacher', usedInId: 'detach-t1', usedInField: 'photoSrc' });
    expect(r.ok).toBe(true);
    const t = await prisma.teacher.findUnique({ where: { id: 'detach-t1' } });
    expect(t!.photoKind).toBe('gradient');
    expect(t!.photoSrc).toBeNull();
    expect(await usageCount(m.id)).toBe(0);
  });
});
```

> Verify the Teacher `create` has all required non-null columns (name/position/badge/
> category at minimum; categoryOrder/order default). Adjust to the real schema if a
> required field is missing. Use `startsWith: 'detach-'` cleanup or explicit ids.

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:int -- media-detach`
Expected: FAIL — `detachMediaUsageAction` not exported yet.

- [ ] **Step 3: Implement `detachMediaUsageAction`** (in `media-actions.ts`)

Add imports: `import { detachMediaUsage, type UsageRow } from '@/lib/media/detach-usage';` and `import { z } from 'zod';`

Extend `revalidateMediaConsumers()` to include the missing tags:
```ts
function revalidateMediaConsumers() {
  for (const t of [
    'media', 'teachers', 'documents', 'achievements', 'gallery',
    'extracurriculars', 'facilities', 'mading',
    'page:home', 'page:profil', 'page:akademik', 'page:fasilitas', 'section-photos',
  ]) revalidateTag(t);
}
```
(Verify these tag names against the entity repos' `unstable_cache` tags — adjust any that differ, e.g. confirm it's `extracurriculars` vs `ekskul`.)

Add the action:
```ts
const detachInputSchema = z.object({
  mediaId: z.string().min(1),
  usedInTable: z.enum(['Teacher', 'Achievement', 'Extracurricular', 'GalleryItem', 'Facility', 'SectionPhoto', 'Mading', 'DocumentSlot']),
  usedInId: z.string().min(1),
  usedInField: z.string().min(1),
});

/**
 * Detach ("Lepaskan") a photo from ONE location: resets the owner's photo
 * reference (entity→gradient, Mading→remove elem, SectionPhoto→clear, DocumentSlot→
 * null) and removes the MediaUsage row, in one transaction. Orphan-safe: a stale
 * usage row (owner no longer references the photo) is simply removed. After all
 * locations are detached, the asset becomes deletable.
 */
export async function detachMediaUsageAction(raw: unknown): Promise<ActionResult<void>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    const input = detachInputSchema.parse(raw);
    const media = await getMediaAssetById(input.mediaId);
    if (!media) throw Object.assign(new Error('not found'), { code: 'P2025' });
    const row: UsageRow = { usedInTable: input.usedInTable, usedInId: input.usedInId, usedInField: input.usedInField };
    await detachMediaUsage(media.publicId, input.mediaId, row);
    writeAudit({
      userId: user.id, action: 'media_detach',
      target: `${input.usedInTable}:${input.usedInId}:${input.usedInField}`,
    }).catch(() => {});
    revalidateMediaConsumers();
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:int -- media-detach`
Expected: PASS (3 tests).

- [ ] **Step 5: Full regression + tsc + lint**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run test:int -- media`
Expected: all green (existing media-delete + media-actions tests still pass).

- [ ] **Step 6: Commit**

```bash
git add "src/app/(admin)/admin/media/_actions/media-actions.ts" src/__tests__/integration/admin/media-detach.test.ts
git commit -m "feat(media): detachMediaUsageAction + full revalidation"
```

---

## Task 4: "Lepaskan" in the picker

**Files:**
- Modify: `src/components/admin/media/ImagePickerModal.tsx`

- [ ] **Step 1: Change `cardState.usage` from `string[]` to raw `UsageRow[]` in ALL THREE spots**

Read the file. The `usage` type appears in THREE places that must ALL change:
1. The `useState` generic (the `cardState` type) — `usage?: string[]` → `usage?: UsageRow[]`.
2. The **`setCard` helper's inline param type** — it ALSO has `usage?: string[]` → `usage?: UsageRow[]` (easy to miss; a separate inline type).
3. `handleDelete` currently does `setCard(id, { status: 'idle', usage: r.data.usage.map(usageLabel) })` → change to `usage: r.data.usage` (store RAW rows, drop `.map`).

Import `UsageRow` from `@/lib/media/detach-usage`. `usageLabel` is already imported; render
`usageLabel(row)` at draw time (Step 2). Without changing all three, tsc fails or the
labels stay pre-stringified (breaking detach).

- [ ] **Step 2: Add the detach handler + per-row "Lepaskan" UI**

Add:
```tsx
import { detachMediaUsageAction } from '@/app/(admin)/admin/media/_actions/media-actions';
// usageLabel already imported

async function handleDetach(id: string, row: { usedInTable: string; usedInId: string; usedInField: string }) {
  setCard(id, { status: 'deleting' });
  const r = await detachMediaUsageAction({ mediaId: id, ...row });
  if (!r.ok) { setCard(id, { status: 'idle', error: 'Gagal melepaskan. Coba lagi.' }); return; }
  // Re-attempt delete to recompute the (now shorter) usage list or finish deleting.
  await handleDelete(id);
}
```

Replace the casual in-use message with a formal list, one row per usage, each with a
"Lepaskan" button:
```tsx
{cardState[m.id]?.usage ? (
  <div className="mt-1 rounded border border-amber-200 bg-amber-50 p-1.5">
    <p className="text-[11px] leading-snug text-amber-800">
      Foto ini masih digunakan. Lepaskan dari setiap lokasi sebelum menghapus.
    </p>
    <ul className="mt-1 space-y-1">
      {cardState[m.id]!.usage!.map((row, i) => (
        <li key={i} className="flex items-center justify-between gap-2 text-[11px]">
          <span className="truncate text-neutral-700">{usageLabel(row)}</span>
          <button
            type="button"
            onClick={() => handleDetach(m.id, row)}
            className="shrink-0 rounded border border-amber-300 px-1.5 py-0.5 font-medium text-amber-800 hover:bg-amber-100"
          >
            Lepaskan
          </button>
        </li>
      ))}
    </ul>
  </div>
) : null}
```

- [ ] **Step 3: tsc + lint + build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: 0 errors / 0 warnings / build OK.

- [ ] **Step 3b (REQUIRED): update the ImagePicker test mock.** `ImagePicker.test.tsx`
  mocks `media-actions` but its factory only exports `deleteMediaAction` — once
  `ImagePickerModal` imports `detachMediaUsageAction`, the mock returns `undefined` for it
  and any call crashes. Add it to the factory:
  ```ts
  jest.mock('@/app/(admin)/admin/media/_actions/media-actions', () => ({
    deleteMediaAction: (...args: unknown[]) => mockDeleteMedia(...args),
    detachMediaUsageAction: jest.fn(async () => ({ ok: true })),
  }));
  ```

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/media/ImagePickerModal.tsx
git commit -m "feat(media): Lepaskan (detach) buttons in the photo picker"
```

---

## Task 5: "Lepaskan" in the media library + final verification

**Files:**
- Modify: `src/app/(admin)/admin/media/MediaManager.tsx`

- [ ] **Step 1: Add per-row "Lepaskan" to the usage modal**

The `usageBlock` modal already lists `usageBlock.usage.map((u,i) => <li>{usageLabel(u)}</li>)`
(usage is already `UsageRow[]`). Add a detach button per row + a detach handler. Import
`detachMediaUsageAction`. After a successful detach, re-attempt `deleteMediaAction(usageBlock.asset.id)`:
- if `{deleted:true}` → remove the asset from the list, close the modal.
- if `{deleted:false, usage}` → update `usageBlock.usage` to the new (shorter) list.

Reword the formal message: "<filename> masih digunakan di {n} lokasi. Lepaskan terlebih
dahulu dari setiap lokasi sebelum menghapus berkas ini." Each `<li>` gets a "Lepaskan"
button (right-aligned) wired to the handler.

```tsx
async function handleDetach(row: UsageRow) {
  if (!usageBlock) return;
  const assetId = usageBlock.asset.id;
  startTransition(async () => {
    const r = await detachMediaUsageAction({ mediaId: assetId, ...row });
    if (!r.ok) { setDeleteError(mapActionError(r.error)); return; }
    const d = await deleteMediaAction(assetId);
    if (d.ok && d.data.deleted) {
      setItems((prev) => prev.filter((m) => m.id !== assetId));
      setUsageBlock(null);
      router.refresh();
    } else if (d.ok && !d.data.deleted) {
      setUsageBlock({ asset: usageBlock.asset, usage: d.data.usage });
    } else if (!d.ok) {
      setDeleteError(mapActionError(d.error));
    }
  });
}
```
(Confirm `UsageRow` type — reuse the local `UsageRow` type already defined at
MediaManager.tsx:16, or import from detach-usage. Confirm `startTransition`/`router` are
in scope — they are, used elsewhere in the file.)

- [ ] **Step 1b (REQUIRED): update the MediaManager test mock.** `MediaManager.test.tsx`
  mocks `media-actions` with only `deleteMediaAction` + `forceDeleteMediaAction`. Adding
  `import { detachMediaUsageAction }` to MediaManager makes the mock return `undefined` for
  it. Add to the factory (near the existing `mockDelete`/`mockForceDelete`):
  ```ts
  const mockDetach = jest.fn(async () => ({ ok: true }));
  // in the jest.mock factory:
  detachMediaUsageAction: (...args: unknown[]) => mockDetach(...args),
  ```

- [ ] **Step 2: Full verification gate**

Run, expect all green:
```bash
npx tsc --noEmit
npm run lint
npm test
npm run test:int
npm run build
```

- [ ] **Step 3: Manual smoke (user-driven)**
- The 2 orphans are already cleaned (Task 1). IMG_3770 should now be deletable directly.
- Pick a photo used by a Teacher → "Hapus" → blocked, shows "Guru" + "Lepaskan" → click
  Lepaskan → teacher returns to placeholder → photo deletes.
- A photo in 2 locations → each shows its own "Lepaskan"; delete only succeeds after both.

- [ ] **Step 4: Commit + push**

```bash
git add "src/app/(admin)/admin/media/MediaManager.tsx"
git commit -m "feat(media): Lepaskan (detach) buttons in the media library"
git push origin phase-0-foundation
```

---

## Final review

Dispatch a code-reviewer over the whole detach diff: orphan-first ordering correct for
every table (esp. Mading empty-images), transactional entity-reset + usage-delete (no
syncPhotoUsage in tx), publicId comparison correct, full revalidation set, picker stores
raw UsageRow, formal copy, seed create-only, orphan cleanup idempotent. Confirm tsc/lint/
tests green. Summarize and stop (no PR).

## Notes / accepted trade-offs

- The detach resolver's entity branch resets to a single neutral gradient placeholder
  (not each entity's bespoke default emoji) — acceptable; the admin can re-pick a photo.
- Re-attempting `deleteMediaAction` after each detach is the single source of truth for
  the remaining usage list (no separate usage endpoint).
- Orphan cleanup script is run manually once per environment (documented), not wired into
  deploy — low risk, rare need.
