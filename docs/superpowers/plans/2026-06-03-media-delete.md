# Media Delete Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Let admins/editors delete a media asset from the "Pilih Foto" picker, actually removing the file from Cloudinary (not just the DB row), refusing in-use assets and listing every location it's used.

**Architecture:** A `cloudinary-destroy` helper (with the required `cloudinary.config()`), wired into the existing `deleteMediaAsset` repo fn (Cloudinary-first, idempotent on not-found); the existing `deleteMediaAction` (usage guard already present) gains it for free; the shared `ImagePickerModal` gets a per-card delete button calling that action; a pure `usage-label` formatter renders friendly per-row usage labels in both the picker and MediaManager.

**Tech Stack:** Next.js 15, React 19, Prisma 6 + MySQL, Cloudinary v2 SDK, jest.

**Spec:** `docs/superpowers/specs/2026-06-03-media-delete-design.md`

**Conventions:** `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess` ON; lint `--max-warnings=0`; tests are jest. Server actions are importable into `'use client'` components (MediaManager already does this).

---

## Task 1: Cloudinary destroy helper

**Files:**
- Create: `src/lib/media/cloudinary-destroy.ts`
- Test: `src/__tests__/lib/media/cloudinary-destroy.test.ts`

- [ ] **Step 1: Write the failing test** (`src/__tests__/lib/media/cloudinary-destroy.test.ts`)

```ts
import { destroyCloudinaryAsset } from '@/lib/media/cloudinary-destroy';

// jest sets NODE_ENV='test', so the helper returns 'destroyed' via the stub gate
// without any network call.
describe('destroyCloudinaryAsset (test gate)', () => {
  it('returns "destroyed" for an image without hitting the network', async () => {
    await expect(destroyCloudinaryAsset('smpn3kresek/image/x', 'image')).resolves.toBe('destroyed');
  });

  it('returns "destroyed" for a raw/pdf publicId', async () => {
    await expect(destroyCloudinaryAsset('smpn3kresek/pdf/x.pdf', 'raw')).resolves.toBe('destroyed');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- cloudinary-destroy`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement** (`src/lib/media/cloudinary-destroy.ts`)

```ts
import 'server-only';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '@/lib/env';

/**
 * Cloudinary hard delete. Mirrors cloudinary-sign.ts's NODE_ENV==='test' stub
 * gate so jest never hits the network.
 *
 * Unlike signing (which passes the secret explicitly to api_sign_request),
 * uploader.destroy builds an authenticated API call and throws "Must supply
 * api_key" unless cloudinary.config() is set — and this project sets neither
 * cloudinary.config() nor CLOUDINARY_URL. So configure it here, once.
 */
let configured = false;
function ensureConfigured(): void {
  if (configured) return;
  cloudinary.config({
    cloud_name: env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
  configured = true;
}

export type DestroyResult = 'destroyed' | 'not_found';

/**
 * Delete a Cloudinary asset. `resourceType` MUST match how it was uploaded:
 * image → 'image', pdf → 'raw' (PDFs upload as raw). Pass the publicId exactly
 * as stored on MediaAsset — for raw/PDF that includes the .pdf extension, which
 * a raw destroy requires.
 *
 * Returns 'destroyed' on result 'ok', 'not_found' on result 'not found'
 * (idempotent — caller treats it as success). Any other result or a thrown
 * SDK/network error is rethrown so the caller can abort and keep the DB row.
 */
export async function destroyCloudinaryAsset(
  publicId: string,
  resourceType: 'image' | 'raw',
): Promise<DestroyResult> {
  if (process.env.NODE_ENV === 'test') {
    return 'destroyed';
  }
  ensureConfigured();
  const res = await cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
    invalidate: true,
  });
  if (res.result === 'ok') return 'destroyed';
  if (res.result === 'not found') return 'not_found';
  throw new Error(`Cloudinary destroy failed: ${res.result}`);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- cloudinary-destroy`
Expected: PASS (2 tests).

- [ ] **Step 5: tsc + lint, then commit**

Run: `npx tsc --noEmit && npm run lint`
```bash
git add src/lib/media/cloudinary-destroy.ts src/__tests__/lib/media/cloudinary-destroy.test.ts
git commit -m "feat(media): cloudinary destroy helper (config + test gate)"
```

---

## Task 2: usage-label formatter

**Files:**
- Create: `src/lib/media/usage-label.ts`
- Test: `src/__tests__/lib/media/usage-label.test.ts`

- [ ] **Step 1: Write the failing test** (`src/__tests__/lib/media/usage-label.test.ts`)

```ts
import { usageLabel } from '@/lib/media/usage-label';

const row = (usedInTable: string, usedInId: string, usedInField: string) => ({
  usedInTable, usedInId, usedInField,
});

describe('usageLabel', () => {
  it('maps entity tables to Indonesian labels', () => {
    expect(usageLabel(row('Teacher', 'abc', 'photoSrc'))).toBe('Guru');
    expect(usageLabel(row('GalleryItem', 'abc', 'photoSrc'))).toBe('Galeri');
    expect(usageLabel(row('Mading', 'abc', 'image:0'))).toBe('Mading');
    expect(usageLabel(row('DocumentSlot', 'kalender-akademik', 'media'))).toBe('Dokumen');
  });

  it('disambiguates SectionPhoto slots per field so two same-section slots differ', () => {
    expect(usageLabel(row('SectionPhoto', 'home:hero:photo', 'photo'))).toBe('Hero Beranda');
    expect(usageLabel(row('SectionPhoto', 'home:sambutan:photo', 'photo'))).toBe('Foto Kepala Sekolah');
    expect(usageLabel(row('SectionPhoto', 'home:about:photoMain', 'photo'))).toBe('Tentang Kami (foto utama)');
    expect(usageLabel(row('SectionPhoto', 'home:about:photoSub', 'photo'))).toBe('Tentang Kami (foto pendukung)');
    expect(usageLabel(row('SectionPhoto', 'profil:sejarah:photo', 'photo'))).toBe('Sejarah');
    expect(usageLabel(row('SectionPhoto', 'akademik:kurikulum:photo', 'photo'))).toBe('Kurikulum');
  });

  it('two distinct about slots must NOT collapse to the same label', () => {
    const a = usageLabel(row('SectionPhoto', 'home:about:photoMain', 'photo'));
    const b = usageLabel(row('SectionPhoto', 'home:about:photoSub', 'photo'));
    expect(a).not.toBe(b);
  });

  it('falls back to the raw table for unknown tables', () => {
    expect(usageLabel(row('Whatever', 'x', 'y'))).toBe('Whatever');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- usage-label`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement** (`src/lib/media/usage-label.ts`)

```ts
export type UsageRow = { usedInTable: string; usedInId: string; usedInField: string };

const TABLE_LABELS: Record<string, string> = {
  Teacher: 'Guru',
  Achievement: 'Prestasi',
  Extracurricular: 'Ekstrakurikuler',
  GalleryItem: 'Galeri',
  Facility: 'Fasilitas',
  Mading: 'Mading',
  DocumentSlot: 'Dokumen',
};

// SectionPhoto slot key (`${pageKey}:${sectionKey}:${field}`) → human name.
// Disambiguated per field where a section owns more than one photo (about), so
// two distinct slots never collapse to the same label.
const SECTION_LABELS: Record<string, string> = {
  'home:hero:photo': 'Hero Beranda',
  'home:sambutan:photo': 'Foto Kepala Sekolah',
  'home:about:photoMain': 'Tentang Kami (foto utama)',
  'home:about:photoSub': 'Tentang Kami (foto pendukung)',
  'profil:sejarah:photo': 'Sejarah',
  'akademik:kurikulum:photo': 'Kurikulum',
};

/** Friendly Indonesian label for a single MediaUsage row. */
export function usageLabel(row: UsageRow): string {
  if (row.usedInTable === 'SectionPhoto') {
    return SECTION_LABELS[row.usedInId] ?? `Halaman (${row.usedInId})`;
  }
  return TABLE_LABELS[row.usedInTable] ?? row.usedInTable;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- usage-label`
Expected: PASS.

- [ ] **Step 5: tsc + lint, then commit**

```bash
git add src/lib/media/usage-label.ts src/__tests__/lib/media/usage-label.test.ts
git commit -m "feat(media): friendly per-row usage label formatter"
```

---

## Task 3: Wire Cloudinary destroy into the repo + action

**Files:**
- Modify: `src/lib/data/repositories/media-repo.ts` (`deleteMediaAsset`)
- Modify: `src/app/(admin)/admin/media/_actions/media-actions.ts` (force-delete best-effort + revalidate tag)
- Test: `src/__tests__/integration/admin/media-delete.test.ts` (new) OR extend the existing media-actions integration test

- [ ] **Step 1: Write the failing integration test** (`src/__tests__/integration/admin/media-delete.test.ts`)

Mock the destroy module (the NODE_ENV gate makes the SDK unreachable). Mirror the auth + `next/cache` mock idiom from existing action tests (e.g. `teacher-actions.test.ts`). Seed a real MediaAsset via `createMediaAsset`; for the in-use case, also seed a MediaUsage row.

```ts
import { prisma } from '@/lib/db/client';
import { createMediaAsset } from '@/lib/data/repositories/media-repo';

const mockSession = { user: { id: 'media-del-test', role: 'ADMIN' as const } };
jest.mock('@/lib/auth/session', () => ({ getSession: jest.fn(async () => mockSession) }));
jest.mock('next/cache', () => ({
  unstable_cache: <T extends (...a: unknown[]) => unknown>(fn: T) => fn,
  revalidateTag: jest.fn(),
  revalidatePath: jest.fn(),
}));

// Mock the destroy helper so we can assert args + simulate not_found / error.
const destroyMock = jest.fn(async () => 'destroyed' as const);
jest.mock('@/lib/media/cloudinary-destroy', () => ({
  destroyCloudinaryAsset: (...args: unknown[]) => destroyMock(...args),
}));

import { deleteMediaAction } from '@/app/(admin)/admin/media/_actions/media-actions';

function mediaInput(seed: number, kind: 'image' | 'pdf') {
  const hex = seed.toString(16).padStart(64, '0');
  const ext = kind === 'pdf' ? '.pdf' : '';
  const pid = `smpn3kresek/${kind === 'pdf' ? 'pdf' : 'image'}/del-${seed}${ext}`;
  return {
    kind, url: `https://res.cloudinary.com/c/${kind === 'pdf' ? 'raw' : 'image'}/upload/v1/${pid}`,
    publicId: pid, hash: hex, alt: null, filename: `f${seed}`, sizeBytes: 1024,
    mimeType: kind === 'pdf' ? 'application/pdf' : 'image/jpeg', width: null, height: null,
    uploadedBy: 'seed',
  };
}

describe('deleteMediaAction + Cloudinary destroy', () => {
  const ids: string[] = [];
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { id: 'media-del-test' } });
    await prisma.user.create({ data: { id: 'media-del-test', email: 'mdt@test.local', passwordHash: 'x', name: 'MDT', role: 'ADMIN' } });
  });
  beforeEach(() => destroyMock.mockClear());
  afterAll(async () => {
    await prisma.mediaUsage.deleteMany({ where: { usedInTable: 'TestOwner' } });
    await prisma.mediaAsset.deleteMany({ where: { id: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: 'media-del-test' } });
    await prisma.$disconnect();
  });

  it('deletes an unused IMAGE: destroy(publicId, "image") then removes the row', async () => {
    const m = await createMediaAsset(mediaInput(801, 'image'));
    ids.push(m.id);
    const r = await deleteMediaAction(m.id);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual({ deleted: true });
    expect(destroyMock).toHaveBeenCalledWith(m.publicId, 'image');
    expect(await prisma.mediaAsset.findUnique({ where: { id: m.id } })).toBeNull();
  });

  it('deletes an unused PDF: destroy(extension-bearing publicId, "raw")', async () => {
    const m = await createMediaAsset(mediaInput(802, 'pdf'));
    ids.push(m.id);
    expect(m.publicId.endsWith('.pdf')).toBe(true);
    const r = await deleteMediaAction(m.id);
    expect(r.ok).toBe(true);
    expect(destroyMock).toHaveBeenCalledWith(m.publicId, 'raw');
  });

  it('refuses an in-use asset: returns usage, does NOT destroy or delete', async () => {
    const m = await createMediaAsset(mediaInput(803, 'image'));
    ids.push(m.id);
    await prisma.mediaUsage.create({ data: { mediaId: m.id, usedInTable: 'TestOwner', usedInId: 'x', usedInField: 'photoSrc' } });
    const r = await deleteMediaAction(m.id);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.deleted).toBe(false);
    expect(destroyMock).not.toHaveBeenCalled();
    expect(await prisma.mediaAsset.findUnique({ where: { id: m.id } })).not.toBeNull();
  });

  it('not_found from destroy still removes the DB row', async () => {
    const m = await createMediaAsset(mediaInput(804, 'image'));
    ids.push(m.id);
    destroyMock.mockResolvedValueOnce('not_found' as const);
    const r = await deleteMediaAction(m.id);
    expect(r.ok).toBe(true);
    expect(await prisma.mediaAsset.findUnique({ where: { id: m.id } })).toBeNull();
  });

  it('a thrown destroy error keeps the DB row and returns ok:false', async () => {
    const m = await createMediaAsset(mediaInput(805, 'image'));
    ids.push(m.id);
    destroyMock.mockRejectedValueOnce(new Error('network'));
    const r = await deleteMediaAction(m.id);
    expect(r.ok).toBe(false);
    expect(await prisma.mediaAsset.findUnique({ where: { id: m.id } })).not.toBeNull();
  });
});
```

> Import path above is the canonical one (`@/app/(admin)/admin/media/_actions/media-actions`),
> matching the existing `media-actions.test.ts`.
> NOTE: an existing `src/__tests__/integration/admin/media-actions.test.ts` already
> covers delete/force-delete WITHOUT a cloudinary-destroy mock — once Task 3 wires the
> helper into the repo, that old test still passes (the NODE_ENV gate returns
> 'destroyed' with no network). This new file adds the Cloudinary-specific assertions.

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:int -- media-delete`
Expected: FAIL (destroy not yet wired into the repo — the unused-image test's `destroyMock` assertion fails, or the thrown-error test deletes the row).

- [ ] **Step 3: Implement — repo** (`media-repo.ts`, replace `deleteMediaAsset`)

Add import near the top: `import { destroyCloudinaryAsset } from '@/lib/media/cloudinary-destroy';`

```ts
export async function deleteMediaAsset(id: string): Promise<void> {
  const row = await prisma.mediaAsset.findUnique({
    where: { id }, select: { publicId: true, kind: true },
  });
  if (!row) throw Object.assign(new Error('not found'), { code: 'P2025' });
  // Cloudinary first. Pass publicId UNCHANGED — for raw/PDF it carries the .pdf
  // extension that a raw destroy requires; stripping it would silently leak the
  // file. A thrown error aborts (DB row kept); 'not_found' is success (already gone).
  const resourceType = row.kind === 'pdf' ? 'raw' : 'image';
  await destroyCloudinaryAsset(row.publicId, resourceType);
  await prisma.mediaAsset.delete({ where: { id } });
}
```

- [ ] **Step 4: Implement — action** (`media-actions.ts`)

(a) Add `revalidateTag('section-photos')` inside `revalidateMediaConsumers()`.
(b) In `forceDeleteMediaAction`, before the `$transaction`, add a best-effort destroy (network call OUTSIDE the transaction):

```ts
// Best-effort: force delete exists for broken rows whose Cloudinary file may be
// missing. Try to remove the file too, but never block the row cleanup on it.
const broken = await getMediaAssetById(id);
if (broken) {
  try {
    await destroyCloudinaryAsset(broken.publicId, broken.kind === 'pdf' ? 'raw' : 'image');
  } catch { /* ignore — the whole point is to clear a row whose file is gone */ }
}
```

Add the import `import { destroyCloudinaryAsset } from '@/lib/media/cloudinary-destroy';` to the action file. `getMediaAssetById` is already imported and returns `PublicMediaAsset` with `{ publicId, kind }` directly (verified) — use `broken.publicId` and `broken.kind` as-is; no extra fetch/select needed.

- [ ] **Step 5: Run to verify it passes**

Run: `npm run test:int -- media-delete`
Expected: PASS (5 tests).

- [ ] **Step 6: tsc + lint + full unit/integration regression, then commit**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run test:int`
```bash
git add src/lib/data/repositories/media-repo.ts "src/app/(admin)/admin/media/_actions/media-actions.ts" src/__tests__/integration/admin/media-delete.test.ts
git commit -m "feat(media): delete removes the Cloudinary file (repo + action)"
```

---

## Task 4: Delete button in the picker dialog

**Files:**
- Modify: `src/components/admin/media/ImagePickerModal.tsx`

(No new test — it's UI over the now-tested action; covered by build + manual smoke. A light RTL test is optional if cheap.)

- [ ] **Step 1: Implement** — add per-card delete to `ImagePickerModal.tsx`.

Add imports:
```tsx
import { useState } from 'react'; // already imports useState; ensure present
import { deleteMediaAction } from '@/app/(admin)/admin/media/_actions/media-actions';
import { usageLabel } from '@/lib/media/usage-label';
```

Add component state for per-card delete status (near the other `useState`s):
```tsx
// id -> transient delete UI state for that card
const [cardState, setCardState] = useState<Record<string, {
  status: 'idle' | 'confirming' | 'deleting';
  usage?: string[];   // friendly labels, one per usage row
  error?: string;
}>>({});
function setCard(id: string, s: { status: 'idle' | 'confirming' | 'deleting'; usage?: string[]; error?: string }) {
  setCardState((prev) => ({ ...prev, [id]: s }));
}
```

Add the delete handler:
```tsx
async function handleDelete(id: string) {
  setCard(id, { status: 'deleting' });
  const r = await deleteMediaAction(id);
  if (!r.ok) {
    setCard(id, { status: 'idle', error: 'Gagal menghapus. Coba lagi.' });
    return;
  }
  if (r.data.deleted) {
    await refresh();                 // photo gone from grid
  } else {
    // In use — list EVERY location (one entry per usage row, no label dedupe).
    setCard(id, { status: 'idle', usage: r.data.usage.map(usageLabel) });
  }
}
```

In each grid `<li>`, under the existing "Pilih" button, add the delete affordance.
Replace the single-button block with "Pilih" + a delete row, showing confirm/usage/error
inline per card:

```tsx
<div className="p-2">
  <p className="truncate text-xs font-medium text-neutral-700" title={m.filename}>{m.filename}</p>
  <button
    type="button"
    onClick={() => onPick({ publicId: m.publicId, url: m.url, alt: m.alt ?? '' })}
    className="mt-1 w-full rounded-md bg-primary px-2 py-1 text-xs font-semibold text-white hover:bg-primary/90"
  >
    Pilih
  </button>

  {(() => {
    const st = cardState[m.id] ?? { status: 'idle' as const };
    if (st.status === 'confirming') {
      return (
        <div className="mt-1 flex gap-1">
          <button type="button" onClick={() => handleDelete(m.id)} className="flex-1 rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700">Ya, hapus</button>
          <button type="button" onClick={() => setCard(m.id, { status: 'idle' })} className="flex-1 rounded border border-neutral-300 px-2 py-1 text-xs">Batal</button>
        </div>
      );
    }
    return (
      <button
        type="button"
        disabled={st.status === 'deleting'}
        onClick={() => setCard(m.id, { status: 'confirming' })}
        className="mt-1 w-full rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {st.status === 'deleting' ? 'Menghapus…' : '🗑 Hapus'}
      </button>
    );
  })()}

  {cardState[m.id]?.usage ? (
    <p className="mt-1 text-[11px] leading-snug text-amber-700">
      Sedang dipakai di: {cardState[m.id]!.usage!.join(', ')}. Lepas dulu di sana.
    </p>
  ) : null}
  {cardState[m.id]?.error ? (
    <p className="mt-1 text-[11px] text-red-600">{cardState[m.id]!.error}</p>
  ) : null}
</div>
```

> Keep the existing list/`refresh`/upload structure intact — only the per-card footer
> changes. `refresh` is already a `useCallback` in scope. Ensure `deleteMediaAction`'s
> return type narrows correctly (`r.ok` then `r.data.deleted`) — the same shape
> MediaManager uses.

- [ ] **Step 2: tsc + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errors, 0 warnings.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/media/ImagePickerModal.tsx
git commit -m "feat(media): delete button + usage list in the photo picker"
```

---

## Task 5: Adopt usage-label in MediaManager + final verification

**Files:**
- Modify: `src/app/(admin)/admin/media/MediaManager.tsx`

- [ ] **Step 1: Replace the raw usage render** (MediaManager.tsx ~line 297) with the
  friendly label, keeping ONE entry per usage row (do not collapse):

```tsx
import { usageLabel } from '@/lib/media/usage-label';
// …
{usageBlock.usage.map((u, i) => (
  <li key={i}>{usageLabel(u)}</li>
))}
```

(Leave the "dipakai di {usage.length} tempat" count header as-is — it already equals
the row count, which now equals the displayed entries.)

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
- Open any entity form → "Pilih Foto"/picker → a photo shows a "🗑 Hapus" button.
- Delete an UNUSED photo → confirm → it disappears from the grid (and from Cloudinary).
- Try deleting an IN-USE photo → blocked, shows "Sedang dipakai di: <labels>" listing
  EVERY location (e.g. a head-teacher photo used in both sambutan + a teacher shows two).
- `/admin/media` usage block now shows friendly labels.

- [ ] **Step 4: Commit + push**

```bash
git add "src/app/(admin)/admin/media/MediaManager.tsx"
git commit -m "feat(media): friendly usage labels in the media library"
git push origin phase-0-foundation
```

---

## Final review

After all tasks, dispatch a code-reviewer over the whole media-delete diff to confirm:
the Cloudinary config is set (C1), PDF publicId passed unchanged (C2), multi-location
shows one entry per usage row with disambiguated labels (no dead-end loop), the usage
guard still blocks in-use deletes, not_found is idempotent, thrown errors keep the row,
and tsc/lint/tests are green. Then summarize and stop (no PR — work stays on the branch).

## Notes / accepted trade-offs

- Server actions aren't rate-limited; Cloudinary's own 429 surfaces as a generic error.
- Concurrent delete of the same asset → loser gets `{ok:false, 'not found'}`, harmless.
- The live Cloudinary path is exercised only via the off-NODE_ENV test (optional) +
  manual smoke; the integration suite mocks the destroy module by design.
