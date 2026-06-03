# Mading Feature Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Mading" (Majalah Dinding / school bulletin board) feature: admin-managed news/info posts with multiple flexible-ratio images, a searchable+sortable public list, and a whole-image detail page.

**Architecture:** A standard CRUD entity mirroring the existing Faq/GalleryItem vertical slice (Prisma model → repo with `unstable_cache`+tags → Zod schema → server actions with `withRole`/audit/`revalidateTag`/`syncPhotoUsage` → admin drawer manager → public pages via `ContentProvider`+`PageLayout`). The novel pieces: a multi-image JSON column, a `MultiImagePicker` admin component, per-image MediaUsage tracking (`image:0`, `image:1`, …), and client-side search/sort.

**Tech Stack:** Next.js 15 App Router, React 19, Prisma 6 + MySQL 8, Zod, react-hook-form, jest (unit jsdom + integration against real MySQL), Cloudinary via `cldUrl`.

**Spec:** `docs/superpowers/specs/2026-06-03-mading-feature-design.md`

**Conventions to honor (tsconfig):** `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are ON. Optional fields use explicit `| undefined`; array indexing yields `T | undefined` (collapse with `?? null` / guards). Lint runs with `--max-warnings=0`.

---

## Chunk 1: Data layer (model, types, schema, repo)

### Task 1: Prisma model + Route type + domain types

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/config/types.ts`

- [ ] **Step 1: Add the `Mading` model to `prisma/schema.prisma`** (after the `Faq` model, before `GalleryItem`, or at end of entity section)

```prisma
model Mading {
  id        String   @id @default(cuid())
  title     String   @db.Text
  body      String?  @db.Text          // multi-paragraph; null = image-only post
  images    Json                        // MadingImage[] : [{ src, alt }]
  order     Int      @default(0)        // reserved for optional manual reorder
  createdAt DateTime @default(now())    // post date + default sort key
  updatedAt DateTime @updatedAt

  @@index([createdAt])
}
```

- [ ] **Step 2: Add types to `src/config/types.ts`** — add `MadingImage` + `Mading`, and extend the `Route` union.

Find `export type Route =` (~line 44) and add `| '/mading'`:
```ts
export type Route =
  | '/'
  | '/profil'
  | '/akademik'
  | '/fasilitas'
  | '/kontak'
  | '/mading';
```

Add the domain types (near the other entity types):
```ts
export type MadingImage = { src: string; alt: string };

export type Mading = {
  id: string;
  title: string;
  body?: string | undefined; // omitted when image-only
  images: MadingImage[];
  createdAt: string;         // ISO string, serialized at the repo boundary
};
```

- [ ] **Step 3: Generate the migration**

Run: `npx prisma migrate dev --name add_mading --skip-seed`
Expected: creates `prisma/migrations/<ts>_add_mading/migration.sql` with `CREATE TABLE Mading` (title/body TEXT, images JSON, index on createdAt). Prisma client regenerates.

- [ ] **Step 4: Verify schema + typecheck**

Run: `npx prisma validate && npx tsc --noEmit`
Expected: "schema is valid", tsc exits 0.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/config/types.ts
git commit -m "feat(mading): add Mading model, domain types, Route union"
```

---

### Task 2: Zod validation schema

**Files:**
- Create: `src/lib/validation/schemas/entities/mading.ts`
- Test: `src/__tests__/lib/validation/mading.test.ts`

- [ ] **Step 1: Write the failing test** (`src/__tests__/lib/validation/mading.test.ts`)

```ts
import { madingSchema } from '@/lib/validation/schemas/entities/mading';

const base = { id: 'm1', title: 'Judul', images: [] as { src: string; alt: string }[] };

describe('madingSchema', () => {
  it('requires a title', () => {
    expect(madingSchema.safeParse({ ...base, title: '', body: 'isi' }).success).toBe(false);
  });

  it('accepts a text-only post (body, no images)', () => {
    expect(madingSchema.safeParse({ ...base, body: 'isi panjang' }).success).toBe(true);
  });

  it('accepts an image-only post (>=1 image, no body)', () => {
    expect(
      madingSchema.safeParse({ ...base, images: [{ src: 'smpn3/foto1', alt: 'Foto' }] }).success,
    ).toBe(true);
  });

  it('rejects a post with neither body nor images', () => {
    expect(madingSchema.safeParse({ ...base, body: '   ' }).success).toBe(false);
  });

  it('rejects an image src that is a full URL', () => {
    expect(
      madingSchema.safeParse({ ...base, body: 'x', images: [{ src: 'https://x/y.jpg', alt: 'a' }] }).success,
    ).toBe(false);
  });

  it('rejects an image with empty alt', () => {
    expect(
      madingSchema.safeParse({ ...base, images: [{ src: 'smpn3/f', alt: '' }] }).success,
    ).toBe(false);
  });

  it('rejects more than 20 images', () => {
    const many = Array.from({ length: 21 }, (_, i) => ({ src: `smpn3/f${i}`, alt: 'a' }));
    expect(madingSchema.safeParse({ ...base, images: many }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- mading.test`
Expected: FAIL — cannot find module `mading`.

- [ ] **Step 3: Implement** (`src/lib/validation/schemas/entities/mading.ts`)

```ts
import { z } from 'zod';

export const madingImageSchema = z.object({
  src: z
    .string()
    .min(1, 'src wajib diisi')
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

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- mading.test`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/validation/schemas/entities/mading.ts src/__tests__/lib/validation/mading.test.ts
git commit -m "feat(mading): Zod schema with body-or-image invariant"
```

---

### Task 3: Repository

**Files:**
- Create: `src/lib/data/repositories/mading-repo.ts`
- Test: `src/__tests__/integration/repositories/mading-write.test.ts`

- [ ] **Step 1: Write the failing integration test** (`src/__tests__/integration/repositories/mading-write.test.ts`)

Match the structure of `src/__tests__/integration/repositories/gallery-write.test.ts` (read it for the setup/teardown idiom — they clean up by id). Key assertions:

```ts
import {
  createMading, getAllMading, getMadingById, updateMading, deleteMading,
} from '@/lib/data/repositories/mading-repo';
import { prisma } from '@/lib/db/client';

describe('mading-repo', () => {
  const ids: string[] = [];
  afterAll(async () => {
    await prisma.mading.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });

  it('creates, reads, round-trips images JSON, updates, deletes', async () => {
    const created = await createMading({
      title: 'Berita A',
      body: 'Paragraf satu.\n\nParagraf dua.',
      images: [{ src: 'smpn3/a1', alt: 'Foto A1' }, { src: 'smpn3/a2', alt: 'Foto A2' }],
    });
    ids.push(created.id);
    expect(created.images).toHaveLength(2);
    expect(created.images[0]).toEqual({ src: 'smpn3/a1', alt: 'Foto A1' });
    expect(typeof created.createdAt).toBe('string');

    const byId = await getMadingById(created.id);
    expect(byId?.title).toBe('Berita A');
    expect(byId?.images).toHaveLength(2);

    const updated = await updateMading(created.id, {
      title: 'Berita A (edit)',
      images: [{ src: 'smpn3/a1', alt: 'Foto A1' }], // dropped a2
    });
    expect(updated.images).toHaveLength(1);
    expect(updated.body).toBeUndefined(); // body cleared -> omitted

    await deleteMading(created.id);
    expect(await getMadingById(created.id)).toBeNull();
  });

  it('getAllMading returns newest first', async () => {
    const a = await createMading({ title: 'Lama', images: [{ src: 'smpn3/x', alt: 'x' }] });
    const b = await createMading({ title: 'Baru', images: [{ src: 'smpn3/y', alt: 'y' }] });
    ids.push(a.id, b.id);
    const all = await getAllMading();
    const idxA = all.findIndex((m) => m.id === a.id);
    const idxB = all.findIndex((m) => m.id === b.id);
    expect(idxB).toBeLessThan(idxA); // b created later -> appears earlier (desc)
  });
});
```

> VERIFIED: `jest.integration.setup.ts:42-46` mocks `next/cache` with
> `unstable_cache: (fn) => fn` (passthrough) and `revalidateTag` as a no-op. So
> `getAllMading` reads LIVE from the DB in integration tests — the assertions
> against it are safe. No need to export/call a separate uncached loader.

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:int -- mading-write`
Expected: FAIL — cannot find module `mading-repo`.

- [ ] **Step 3: Implement** (`src/lib/data/repositories/mading-repo.ts`)

```ts
import { unstable_cache } from 'next/cache';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import type { Mading, MadingImage } from '@config/types';
import { madingImageSchema } from '@/lib/validation/schemas/entities/mading';
import { z } from 'zod';

type MadingRow = {
  id: string;
  title: string;
  body: string | null;
  images: Prisma.JsonValue;
  createdAt: Date;
};

// Defensive: a malformed images column must never crash a read.
const imagesParser = z.array(madingImageSchema).catch([] as MadingImage[]);

function rowToMading(r: MadingRow): Mading {
  const item: Mading = {
    id: r.id,
    title: r.title,
    images: imagesParser.parse(r.images),
    createdAt: r.createdAt.toISOString(),
  };
  if (r.body && r.body.trim().length > 0) item.body = r.body;
  return item;
}

async function loadAllMading(): Promise<Mading[]> {
  const rows = await prisma.mading.findMany({ orderBy: [{ createdAt: 'desc' }] });
  return rows.map(rowToMading);
}

export const getAllMading = unstable_cache(loadAllMading, ['mading', 'all'], {
  tags: ['mading'],
});

export async function getMadingById(id: string): Promise<Mading | null> {
  const row = await prisma.mading.findUnique({ where: { id } });
  return row ? rowToMading(row) : null;
}

export type MadingInput = {
  title: string;
  body?: string | undefined;
  images: MadingImage[];
};

function inputToData(input: MadingInput) {
  return {
    title: input.title,
    body: input.body && input.body.trim().length > 0 ? input.body : null,
    images: input.images as unknown as Prisma.InputJsonValue,
  };
}

export async function createMading(input: MadingInput): Promise<Mading> {
  const max = await prisma.mading.aggregate({ _max: { order: true } });
  const order = (max._max.order ?? -1) + 1;
  const row = await prisma.mading.create({ data: { ...inputToData(input), order } });
  return rowToMading(row);
}

export async function updateMading(id: string, input: MadingInput): Promise<Mading> {
  const row = await prisma.mading.update({ where: { id }, data: inputToData(input) });
  return rowToMading(row);
}

export async function deleteMading(id: string): Promise<void> {
  await prisma.mading.delete({ where: { id } });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:int -- mading-write`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/repositories/mading-repo.ts src/__tests__/integration/repositories/mading-write.test.ts
git commit -m "feat(mading): repository with cached list + JSON images round-trip"
```

---

## Chunk 2: Server actions + media tracking

### Task 4: Server actions with per-image MediaUsage

**Files:**
- Create: `src/app/(admin)/admin/entities/_actions/mading-actions.ts`
- Test: extend `src/__tests__/integration/repositories/mading-write.test.ts` OR a new `src/__tests__/integration/admin/mading-actions.test.ts` (prefer the latter; mirror `teacher-actions.test.ts` / the media-usage tests for the auth-mock + MediaAsset-seeding idiom).

- [ ] **Step 1: Write the failing integration test** (`src/__tests__/integration/admin/mading-actions.test.ts`)

Read an existing action integration test (e.g. `src/__tests__/integration/admin/teacher-actions.test.ts` and `media/sync-photo-usage.test.ts`) to copy: how the session/`getSession` is mocked to an ADMIN user, and how a `MediaAsset` row is seeded so `syncPhotoUsage` can resolve a publicId → mediaId. Assertions:

```ts
// after seeding two MediaAsset rows with publicId 'smpn3/img-a' and 'smpn3/img-b':

// create with image-a -> a MediaUsage row exists for (Mading, id, image:0)
// update to [image-a, image-b] -> usage rows for image:0 AND image:1
// update to [image-b] only -> image:0 now points at b's mediaId, image:1 removed
// delete -> all Mading usage rows for that id removed
```

Use the existing helper that counts `prisma.mediaUsage.findMany({ where: { usedInTable: 'Mading', usedInId } })`.

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:int -- mading-actions`
Expected: FAIL — cannot find module `mading-actions`.

- [ ] **Step 3: Implement** (`src/app/(admin)/admin/entities/_actions/mading-actions.ts`)

```ts
'use server';

import { revalidateTag } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { withRole, type ActionResult } from '@/lib/auth/server-action-guard';
import { writeAudit } from '@/lib/security/audit';
import { madingSchema } from '@/lib/validation/schemas/entities/mading';
import {
  createMading, updateMading, deleteMading, getMadingById,
  type MadingInput,
} from '@/lib/data/repositories/mading-repo';
import { syncPhotoUsage } from '@/lib/media/sync-photo-usage';
import type { Mading, MadingImage, Photo } from '@config/types';

const madingInputSchema = madingSchema.omit({ id: true });

function revalidateMading() {
  revalidateTag('mading');
}

const imageRef = (id: string, i: number) => ({
  usedInTable: 'Mading',
  usedInId: id,
  usedInField: `image:${i}`,
});

function toUrlPhoto(img: MadingImage | undefined): Photo | null {
  return img ? { kind: 'url', src: img.src, alt: img.alt } : null;
}

/**
 * Diff two image arrays slot-by-slot and sync each MediaUsage. Keyed by array
 * index; reordering produces redundant-but-correct unlink/relink (idempotent).
 */
async function syncImageUsages(
  id: string,
  prev: MadingImage[],
  next: MadingImage[],
): Promise<void> {
  const len = Math.max(prev.length, next.length);
  for (let i = 0; i < len; i++) {
    await syncPhotoUsage(toUrlPhoto(prev[i]), toUrlPhoto(next[i]), imageRef(id, i));
  }
}

export async function createMadingAction(raw: unknown): Promise<ActionResult<Mading>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    const input = madingInputSchema.parse(raw) as MadingInput;
    const created = await createMading(input);
    await syncImageUsages(created.id, [], created.images);
    await writeAudit({ userId: user.id, action: 'create_mading', target: `mading:${created.id}` }).catch(() => {});
    revalidateMading();
    return created;
  });
}

export async function updateMadingAction(id: string, raw: unknown): Promise<ActionResult<Mading>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    const input = madingInputSchema.parse(raw) as MadingInput;
    const prev = await getMadingById(id);
    const updated = await updateMading(id, input);
    await syncImageUsages(id, prev?.images ?? [], updated.images);
    await writeAudit({ userId: user.id, action: 'update_mading', target: `mading:${id}` }).catch(() => {});
    revalidateMading();
    return updated;
  });
}

export async function deleteMadingAction(id: string): Promise<ActionResult<void>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    const prev = await getMadingById(id);
    await deleteMading(id);
    await syncImageUsages(id, prev?.images ?? [], []);
    await writeAudit({ userId: user.id, action: 'delete_mading', target: `mading:${id}` }).catch(() => {});
    revalidateMading();
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:int -- mading-actions`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(admin)/admin/entities/_actions/mading-actions.ts" src/__tests__/integration/admin/mading-actions.test.ts
git commit -m "feat(mading): server actions with per-image MediaUsage tracking"
```

---

## Chunk 3: ContentProvider wiring

### Task 5: Provider methods + nav schema

**Files:**
- Modify: `src/lib/data/ContentProvider.ts`
- Modify: `src/lib/data/StaticContentProvider.ts`
- Modify: `src/lib/data/ApiContentProvider.ts`
- Modify: `src/lib/validation/schemas/navigation.ts`
- Modify: `src/config/navigation.ts`

- [ ] **Step 1: Add interface methods** to `src/lib/data/ContentProvider.ts`. Import `Mading` from `@config/types` if not already, and add to the interface:

```ts
  getMadingList(): Promise<Mading[]>;
  getMadingById(id: string): Promise<Mading | null>;
```

- [ ] **Step 2: Implement in `StaticContentProvider.ts`** (DB-only feature → empty in static mode):

```ts
  async getMadingList() {
    return [];
  }
  async getMadingById() {
    return null;
  }
```

- [ ] **Step 3: Implement in `ApiContentProvider.ts`** (delegate to repo). Add import:
```ts
import { getAllMading, getMadingById as getMadingByIdRepo } from './repositories/mading-repo';
```
and methods:
```ts
  getMadingList() { return getAllMading(); }
  getMadingById(id: string) { return getMadingByIdRepo(id); }
```
While here, fix the stale class doc comment "reads all content from Postgres" → "from MySQL".

- [ ] **Step 4: Extend `routeSchema` in `src/lib/validation/schemas/navigation.ts`** — it is a `z.enum([...])` (navigation.ts:3). Add `'/mading'` as a new array element:
```ts
export const routeSchema = z.enum(['/', '/profil', '/akademik', '/fasilitas', '/kontak', '/mading']);
```
(So the seed's `navigationSchema.parse(rawNav)` accepts the new nav item.)

- [ ] **Step 5: Add the public nav link** in `src/config/navigation.ts` after Fasilitas:
```ts
  { label: 'Mading', href: '/mading' },
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors (proves Route + routeSchema + provider all align).

- [ ] **Step 7: Commit**

```bash
git add src/lib/data/ContentProvider.ts src/lib/data/StaticContentProvider.ts src/lib/data/ApiContentProvider.ts src/lib/validation/schemas/navigation.ts src/config/navigation.ts
git commit -m "feat(mading): ContentProvider methods + /mading nav route"
```

---

## Chunk 4: Admin UI

### Task 6: MultiImagePicker component

**Files:**
- Create: `src/components/admin/form/MultiImagePicker.tsx`

(No standalone unit test — it's a thin UI wrapper; it's exercised via the manager and build. If a quick component test is cheap, add one asserting "add appends, remove drops, alt edits the right row," but it's optional.)

- [ ] **Step 1: Implement** (`src/components/admin/form/MultiImagePicker.tsx`)

```tsx
'use client';

import { cldUrl } from '@/lib/media/cldUrl';
import type { MadingImage } from '@config/types';
import type { OpenImagePicker } from '@/components/admin/media/types';
import { inputClass } from '@/components/admin/form/FormField';

type MultiImagePickerProps = {
  value: MadingImage[];
  onChange: (next: MadingImage[]) => void;
  openImagePicker: OpenImagePicker;
  disabled?: boolean;
};

export function MultiImagePicker({ value, onChange, openImagePicker, disabled }: MultiImagePickerProps) {
  // IMPORTANT: opening the picker must NOT be wrapped in startTransition by the
  // caller; this handler is a plain async click handler (React 19 defers the
  // modal mount otherwise).
  async function handleAdd() {
    const picked = await openImagePicker({ kind: 'image' });
    if (picked) {
      onChange([...value, { src: picked.publicId, alt: picked.alt }]);
    }
  }

  function updateAlt(i: number, alt: string) {
    onChange(value.map((img, j) => (j === i ? { ...img, alt } : img)));
  }

  function remove(i: number) {
    onChange(value.filter((_, j) => j !== i));
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    const a = next[i];
    const b = next[j];
    if (!a || !b) return; // noUncheckedIndexedAccess guard
    next[i] = b;
    next[j] = a;
    onChange(next);
  }

  return (
    <div className="space-y-3">
      {value.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Belum ada gambar. Posting boleh tanpa gambar (teks saja) atau tambahkan satu/lebih.
        </p>
      ) : (
        <ul className="space-y-2">
          {value.map((img, i) => (
            <li key={`${img.src}-${i}`} className="flex items-start gap-3 rounded-md border border-neutral-200 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary CDN preview */}
              <img src={cldUrl(img.src, 'avatar')} alt={img.alt} className="h-14 w-14 shrink-0 rounded object-cover" />
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-neutral-600">Alt (deskripsi gambar)</label>
                <input
                  className={inputClass}
                  value={img.alt}
                  disabled={disabled}
                  onChange={(e) => updateAlt(i, e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <button type="button" disabled={disabled || i === 0} onClick={() => move(i, -1)} className="rounded border border-neutral-300 px-2 text-sm disabled:opacity-30" aria-label="Naik">↑</button>
                <button type="button" disabled={disabled || i === value.length - 1} onClick={() => move(i, 1)} className="rounded border border-neutral-300 px-2 text-sm disabled:opacity-30" aria-label="Turun">↓</button>
                <button type="button" disabled={disabled} onClick={() => remove(i)} className="rounded border border-red-300 px-2 text-sm text-red-600 disabled:opacity-30" aria-label="Hapus">✕</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={handleAdd}
        disabled={disabled}
        className="rounded-md border border-primary px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/5 disabled:opacity-50"
      >
        ➕ Tambah Gambar
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/form/MultiImagePicker.tsx
git commit -m "feat(mading): MultiImagePicker (add/remove/reorder/alt per image)"
```

---

### Task 7: Admin manager + page + nav entry

**Files:**
- Create: `src/app/(admin)/admin/entities/mading/MadingManager.tsx`
- Create: `src/app/(admin)/admin/entities/mading/page.tsx`
- Modify: `src/config/admin-nav.ts`

- [ ] **Step 1: Implement `MadingManager.tsx`** — mirror `GalleryItemManager.tsx` exactly, but with the `images` field via `MultiImagePicker` (not PhotoPicker), a `body` textarea, and no category/span/crop.

```tsx
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Mading } from '@config/types';
import { madingImageSchema } from '@/lib/validation/schemas/entities/mading';
import { EntityTable } from '@/components/admin/EntityTable';
import { EntityDrawer } from '@/components/admin/EntityDrawer';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import { mapActionError } from '@/components/admin/mapActionError';
import { FormField, inputClass } from '@/components/admin/form/FormField';
import { MultiImagePicker } from '@/components/admin/form/MultiImagePicker';
import { useImagePicker } from '@/components/admin/media/useImagePicker';
import { cldUrl } from '@/lib/media/cldUrl';
import {
  createMadingAction, updateMadingAction, deleteMadingAction,
} from '@/app/(admin)/admin/entities/_actions/mading-actions';

const formSchema = z
  .object({
    title: z.string().min(1, 'Judul wajib diisi'),
    body: z.string(),
    images: z.array(madingImageSchema),
  })
  .superRefine((v, ctx) => {
    if (v.body.trim().length === 0 && v.images.length === 0) {
      ctx.addIssue({ code: 'custom', message: 'Isi teks atau minimal satu gambar', path: ['body'] });
    }
  });
type FormValues = z.infer<typeof formSchema>;

export function MadingManager({ initialItems }: { initialItems: Mading[] }) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Mading | null>(null);
  const [deleting, setDeleting] = useState<Mading | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { open: openImagePicker } = useImagePicker();

  const { register, handleSubmit, reset, control, formState: { errors } } =
    useForm<FormValues>({ resolver: zodResolver(formSchema) });

  function openCreate() {
    setEditing(null);
    setFormError(null);
    reset({ title: '', body: '', images: [] });
    setDrawerOpen(true);
  }

  function openEdit(m: Mading) {
    setEditing(m);
    setFormError(null);
    reset({ title: m.title, body: m.body ?? '', images: m.images });
    setDrawerOpen(true);
  }

  function toInput(v: FormValues) {
    const body = v.body.trim();
    return { title: v.title, images: v.images, ...(body ? { body } : {}) };
  }

  function onSubmit(v: FormValues) {
    setFormError(null);
    startTransition(async () => {
      const result = editing
        ? await updateMadingAction(editing.id, toInput(v))
        : await createMadingAction(toInput(v));
      if (result.ok) {
        setDrawerOpen(false);
        router.refresh();
      } else {
        setFormError(mapActionError(result.error));
      }
    });
  }

  function confirmDelete() {
    if (!deleting) return;
    const id = deleting.id;
    setDeleteError(null);
    startTransition(async () => {
      const result = await deleteMadingAction(id);
      if (result.ok) {
        setDeleting(null);
        router.refresh();
      } else {
        setDeleteError(mapActionError(result.error));
      }
    });
  }

  const imagesErrorMessage = (errors.body as { message?: string } | undefined)?.message;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-extrabold text-neutral-900">Mading</h1>
          <p className="text-sm text-neutral-600">Kelola berita & informasi terbaru sekolah.</p>
        </div>
      </div>

      <EntityTable<Mading>
        rows={initialItems}
        getId={(m) => m.id}
        getSearchText={(m) => `${m.title} ${m.body ?? ''}`}
        columns={[
          { header: 'Judul', cell: (m) => (
            <span className="flex items-center gap-2 font-medium">
              {m.images[0] ? (
                // eslint-disable-next-line @next/next/no-img-element -- admin preview
                <img src={cldUrl(m.images[0].src, 'avatar')} alt={m.images[0].alt} className="h-8 w-8 rounded object-cover" />
              ) : (
                <span aria-hidden>📝</span>
              )}
              {m.title}
            </span>
          )},
          { header: 'Gambar', cell: (m) => (m.images.length > 0 ? `📷 ${m.images.length}` : '—') },
          { header: 'Tanggal', cell: (m) => new Date(m.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) },
        ]}
        onEdit={openEdit}
        onDelete={(m) => setDeleting(m)}
        onReorder={() => { /* no manual reorder — list sorts by date */ }}
        addButton={
          <button type="button" onClick={openCreate} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90">
            + Tambah Mading
          </button>
        }
      />

      <EntityDrawer open={drawerOpen} title={editing ? 'Edit Mading' : 'Tambah Mading'} onClose={() => setDrawerOpen(false)}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Judul" htmlFor="m-title" error={errors.title?.message}>
            <input id="m-title" className={inputClass} {...register('title')} />
          </FormField>
          <FormField label="Isi" htmlFor="m-body" hint="Opsional. Baris kosong = paragraf baru." error={errors.body?.message}>
            <textarea id="m-body" rows={6} className={inputClass} {...register('body')} />
          </FormField>
          <FormField label="Gambar" htmlFor="m-images" hint="Rasio bebas; tampil utuh di halaman detail." error={imagesErrorMessage}>
            <Controller
              name="images"
              control={control}
              render={({ field }) => (
                <MultiImagePicker
                  value={field.value}
                  onChange={field.onChange}
                  openImagePicker={openImagePicker}
                  disabled={isPending}
                />
              )}
            />
          </FormField>
          {formError ? <p className="text-sm text-red-600" role="alert">{formError}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setDrawerOpen(false)} className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100">Batal</button>
            <button type="submit" disabled={isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50">
              {isPending ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </form>
      </EntityDrawer>

      <DeleteConfirmDialog
        key={deleting?.id ?? 'none'}
        open={deleting !== null}
        itemName={deleting?.title ?? ''}
        onConfirm={confirmDelete}
        onCancel={() => { setDeleting(null); setDeleteError(null); }}
        error={deleteError ?? undefined}
      />
    </div>
  );
}
```

> The picker opens inside `MultiImagePicker.handleAdd` (a plain async handler), NOT inside `startTransition` — only the action dispatch is in a transition. This matches the Phase 3/4 lesson.

- [ ] **Step 2: Implement `page.tsx`** (mirror `faqs/page.tsx`):

```tsx
import { auth } from '@/lib/auth/config';
import { AdminShell } from '@/components/admin/AdminShell';
import { getAllMading } from '@/lib/data/repositories/mading-repo';
import { MadingManager } from './MadingManager';

export const dynamic = 'force-dynamic';

export default async function MadingPage() {
  const session = await auth();
  const items = await getAllMading();
  return (
    <AdminShell userName={session?.user.name ?? 'Admin'} role={session?.user.role ?? 'EDITOR'}>
      <MadingManager initialItems={items} />
    </AdminShell>
  );
}
```

> Verified against `faqs/page.tsx`: `auth` comes from `@/lib/auth/config` (NOT
> `@/lib/auth` — that module does not exist). `AdminShell` props are
> `{ userName: string; role: Role }`.

- [ ] **Step 3: Add nav entry** to `src/config/admin-nav.ts` in the Konten group, near Galeri:
```ts
{ label: 'Mading', href: '/admin/entities/mading', icon: '📰', roles: ['ADMIN', 'EDITOR'] },
```

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errors, 0 warnings.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(admin)/admin/entities/mading" src/config/admin-nav.ts
git commit -m "feat(mading): admin manager, page, nav entry"
```

---

## Chunk 5: Public UI

### Task 8: MadingCard + MadingList (client search/sort)

**Files:**
- Create: `src/components/organisms/mading/MadingCard.tsx`
- Create: `src/components/organisms/mading/MadingList.tsx`
- Test: `src/__tests__/components/mading/mading-list.test.tsx`

> Confirm the components directory convention by checking where `GallerySection`/`FaqSection` live (likely `src/components/organisms/<page>/`). Place Mading components consistently. Adjust import paths in the public page accordingly.

- [ ] **Step 1: Write the failing test** (`src/__tests__/components/mading/mading-list.test.tsx`)

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MadingList } from '@/components/organisms/mading/MadingList';
import type { Mading } from '@config/types';

const items: Mading[] = [
  { id: '1', title: 'Pengumuman Libur', body: 'Sekolah libur', images: [], createdAt: '2026-01-01T00:00:00.000Z' },
  { id: '2', title: 'Juara Lomba', body: 'Tim basket menang', images: [], createdAt: '2026-03-01T00:00:00.000Z' },
];

describe('MadingList', () => {
  it('renders all posts initially, newest first', () => {
    render(<MadingList items={items} />);
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings[0]).toContain('Juara'); // newest (2026-03) first
  });

  it('filters by title or body via search', async () => {
    render(<MadingList items={items} />);
    await userEvent.type(screen.getByRole('searchbox'), 'basket');
    expect(screen.queryByText(/Pengumuman Libur/)).not.toBeInTheDocument();
    expect(screen.getByText(/Juara Lomba/)).toBeInTheDocument();
  });

  it('sorts oldest-first when selected', async () => {
    render(<MadingList items={items} />);
    await userEvent.selectOptions(screen.getByRole('combobox'), 'oldest');
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings[0]).toContain('Pengumuman'); // oldest (2026-01) first
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- mading-list`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement `MadingCard.tsx`**

```tsx
import Link from 'next/link';
import { cldUrl } from '@/lib/media/cldUrl';
import type { Mading } from '@config/types';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function MadingCard({ item }: { item: Mading }) {
  const cover = item.images[0];
  return (
    <Link
      href={`/mading/${item.id}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm transition hover:shadow-md"
    >
      {cover ? (
        <div className="relative aspect-[16/9] overflow-hidden bg-neutral-100">
          {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary CDN */}
          <img src={cldUrl(cover.src, 'card')} alt={cover.alt} className="h-full w-full object-cover transition group-hover:scale-105" />
          {item.images.length > 1 ? (
            <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">📷 {item.images.length}</span>
          ) : null}
        </div>
      ) : (
        <div className="flex aspect-[16/9] items-center justify-center bg-gradient-to-br from-primary to-primary-light text-5xl text-white" aria-hidden>📝</div>
      )}
      <div className="flex flex-1 flex-col p-4">
        <time className="text-xs font-medium text-neutral-500">{formatDate(item.createdAt)}</time>
        <h3 className="mt-1 font-heading text-lg font-bold leading-snug text-neutral-900 line-clamp-2">{item.title}</h3>
        {item.body ? <p className="mt-2 text-sm text-neutral-600 line-clamp-3">{item.body}</p> : null}
      </div>
    </Link>
  );
}
```

> Verify `from-primary`/`to-primary-light` exist in the Tailwind theme (check `tailwind.config`); if not, use a literal gradient style like other placeholders do.

- [ ] **Step 4: Implement `MadingList.tsx`**

```tsx
'use client';

import { useMemo, useState } from 'react';
import type { Mading } from '@config/types';
import { MadingCard } from './MadingCard';

type SortKey = 'newest' | 'oldest' | 'title';

export function MadingList({ items }: { items: Mading[] }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? items.filter((m) => `${m.title} ${m.body ?? ''}`.toLowerCase().includes(q))
      : items.slice();
    filtered.sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title, 'id');
      const da = new Date(a.createdAt).getTime();
      const db = new Date(b.createdAt).getTime();
      return sort === 'oldest' ? da - db : db - da;
    });
    return filtered;
  }, [items, query, sort]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari berita…"
          className="w-full rounded-md border border-neutral-300 px-4 py-2 text-sm sm:max-w-xs"
          aria-label="Cari mading"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          aria-label="Urutkan mading"
        >
          <option value="newest">Terbaru</option>
          <option value="oldest">Terlama</option>
          <option value="title">Judul A–Z</option>
        </select>
      </div>

      {visible.length === 0 ? (
        <p className="py-16 text-center text-neutral-500">
          {query ? 'Tidak ada hasil untuk pencarian ini.' : 'Belum ada postingan mading.'}
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((m) => <MadingCard key={m.id} item={m} />)}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test -- mading-list`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/organisms/mading src/__tests__/components/mading
git commit -m "feat(mading): public MadingList (search+sort) and MadingCard"
```

---

### Task 9: Public list + detail pages

**Files:**
- Create: `src/app/mading/page.tsx`
- Create: `src/app/mading/[id]/page.tsx`

> VERIFIED: there is NO `(public)` route group. Public pages are top-level siblings:
> `src/app/kontak/`, `src/app/profil/`, `src/app/akademik/`, `src/app/fasilitas/`.
> Mading public pages go at **`src/app/mading/page.tsx`** and
> **`src/app/mading/[id]/page.tsx`** — exactly as the file headers state.

- [ ] **Step 1: Implement list `page.tsx`** (mirror `kontak/page.tsx`):

```tsx
import type { Metadata } from 'next';
import { getContentProvider } from '@lib/data';
import { PageLayout } from '@components/templates/PageLayout';
import { PageHeader } from '@components/organisms/PageHeader';
import { MadingList } from '@components/organisms/mading/MadingList';
import { Container } from '@components/atoms/Container';

export const metadata: Metadata = {
  title: 'Mading — SMPN 3 Kresek',
  description: 'Berita dan informasi terbaru seputar SMPN 3 Kresek.',
};

export default async function MadingPage() {
  const provider = getContentProvider();
  const [site, items] = await Promise.all([provider.getSiteConfig(), provider.getMadingList()]);
  return (
    <PageLayout site={site} activeRoute="/mading">
      <PageHeader
        config={{
          breadcrumb: [{ label: 'Beranda', href: '/' }, { label: 'Mading' }],
          title: 'Majalah Dinding',
          subtitle: 'Berita & informasi terbaru sekolah.',
        }}
      />
      <section className="bg-neutral-50 py-16">
        <Container>
          <MadingList items={items} />
        </Container>
      </section>
    </PageLayout>
  );
}
```

> VERIFIED `PageHeaderConfig` (src/config/types.ts:344-348) is
> `{ breadcrumb: { label: string; href?: string }[]; title: string; subtitle: string }`.
> There is NO `eyebrow`/`description`; `breadcrumb` is REQUIRED (PageHeader renders
> it — passing undefined crashes BreadcrumbNav). Use the literal above exactly.

- [ ] **Step 2: Implement detail `[id]/page.tsx`**

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getContentProvider } from '@lib/data';
import { PageLayout } from '@components/templates/PageLayout';
import { Container } from '@components/atoms/Container';
import { cldUrl } from '@/lib/media/cldUrl';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const post = await getContentProvider().getMadingById(id);
  return { title: post ? `${post.title} — Mading SMPN 3 Kresek` : 'Mading — SMPN 3 Kresek' };
}

export default async function MadingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const provider = getContentProvider();
  const [site, post] = await Promise.all([provider.getSiteConfig(), provider.getMadingById(id)]);
  if (!post) notFound();

  const paragraphs = (post.body ?? '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const date = new Date(post.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <PageLayout site={site} activeRoute="/mading">
      <article className="bg-white py-16">
        <Container className="max-w-3xl">
          <time className="text-sm font-medium text-neutral-500">{date}</time>
          <h1 className="mt-2 font-heading text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl">{post.title}</h1>
          {paragraphs.length > 0 ? (
            <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-neutral-700">
              {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
            </div>
          ) : null}
          {post.images.length > 0 ? (
            <div className="mt-8 space-y-6">
              {post.images.map((img, i) => (
                <figure key={`${img.src}-${i}`} className="overflow-hidden rounded-lg bg-neutral-900">
                  {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary CDN, native ratio preserved */}
                  <img src={cldUrl(img.src, 'original')} alt={img.alt} className="mx-auto max-h-[70vh] w-full object-contain" />
                </figure>
              ))}
            </div>
          ) : null}
        </Container>
      </article>
    </PageLayout>
  );
}
```

> `params` is a Promise in Next 15 — confirm whether this project's other dynamic routes `await params`. If the codebase uses the sync form, match it. Use whatever the existing dynamic routes do.

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errors, 0 warnings.

- [ ] **Step 4: Build smoke**

Run: `npm run build`
Expected: build succeeds; `/mading` and `/mading/[id]` appear in the route list.

- [ ] **Step 5: Commit**

```bash
git add src/app/mading
git commit -m "feat(mading): public list + whole-image detail pages"
```

---

## Chunk 6: Seed + final verification

### Task 10: Seed examples + reseed + full verification

**Files:**
- Modify: `scripts/seed-content.ts`

- [ ] **Step 1: Add a Mading seed block** near the other entity seeds. Idempotent (skip if any Mading rows already exist, OR upsert by stable ids `mading-1/2/3`). Since there are no guaranteed real Cloudinary publicIds, seed text-only / minimal examples with `images: []` to avoid 404s (per spec):

```ts
// ==> Seed: Mading (demo posts; school replaces these)
console.log('==> Seed: Mading');
const madingSeed = [
  { id: 'mading-1', title: 'Selamat Datang di Mading SMPN 3 Kresek', body: 'Mading digital ini berisi berita dan informasi terbaru seputar kegiatan sekolah.\n\nPantau terus untuk pengumuman penting.', images: [] as { src: string; alt: string }[] },
  { id: 'mading-2', title: 'Kegiatan Belajar Mengajar Semester Ini', body: 'Kegiatan belajar mengajar berjalan lancar dengan berbagai program unggulan.', images: [] },
];
for (let i = 0; i < madingSeed.length; i++) {
  const m = madingSeed[i]!;
  await prisma.mading.upsert({
    where: { id: m.id },
    update: { title: m.title, body: m.body, images: m.images, order: i },
    create: { id: m.id, title: m.title, body: m.body, images: m.images, order: i },
  });
}
```

> VERIFIED: `seed-content.ts` imports only `{ prisma }`, NOT `{ Prisma }`. The
> existing Json-column idiom passes the JS value DIRECTLY with no cast (e.g.
> `hoursByGrade: s.hoursByGrade` at seed-content.ts:287). Pass `images: m.images`
> directly as above — Prisma accepts a plain JS array for a `Json` column. Do NOT
> add a `Prisma.InputJsonValue` cast (would require importing `Prisma`, which the
> file doesn't).

- [ ] **Step 2: Reseed nav + content** (propagates the `/mading` nav link and demo posts)

Run: `npm run db:seed:content`
Expected: logs "==> Seed: Mading", no errors. Nav now includes Mading.

- [ ] **Step 3: Full verification gate**

Run each, expect all green:
```bash
npx tsc --noEmit
npm run lint
npm test
npm run test:int
npm run build
```

- [ ] **Step 4: Data smoke**

Run a quick query (like the migration smoke) to confirm: `prisma.mading.count()` ≥ 2, nav row contains `/mading`. Optionally start the dev server and load `/mading`, `/mading/mading-1`, `/admin/entities/mading` (guarded to login) to eyeball.

- [ ] **Step 5: Commit**

```bash
git add scripts/seed-content.ts
git commit -m "feat(mading): seed demo posts + propagate nav link"
```

---

## Final review

After all tasks, dispatch a final code-reviewer over the whole Mading diff (all commits since the spec) to confirm: spec compliance, no orphaned MediaUsage logic errors, the index-based usage diff is correct, flexible-ratio rendering uses `original` (not `card`/`c_fill`) on detail, search/sort correct, and TypeScript strict-mode cleanliness. Then summarize for the user and stop (do not open a PR — user works on this branch).

## Notes / known acceptable trade-offs

- `order` column has no writer beyond create's max+1; list sorts by date. Reserved for future manual reorder without a migration.
- Index-based `usedInField` (`image:N`) means reordering images churns unlink/relink but stays correct (idempotent, unique constraint). Orphan accounting remains accurate.
- `StaticContentProvider` returns empty Mading data; the site runs in `api` mode in practice.
- Seed uses empty `images: []` to avoid referencing non-existent Cloudinary publicIds; the school adds real images via the admin UI.
