# Media Delete (from picker + Cloudinary) — Design Spec

**Date:** 2026-06-03
**Status:** Approved (decisions confirmed by user)

## Goal

Let admins/editors delete a media asset they uploaded by mistake **from the "Pilih
Foto" picker dialog** (where they notice it), and make delete actually **remove the
file from Cloudinary** (not just the DB row) so wrong uploads stop wasting storage.
A media asset that is still in use must NOT be deletable — the UI tells the user
where it's used.

## Problem (verified)

1. The picker dialog (`ImagePickerModal`) has no delete affordance — only "Pilih".
   A wrong upload can only be cleaned from the separate `/admin/media` page.
2. **`deleteMediaAsset` (media-repo.ts) only does `prisma.mediaAsset.delete()`** —
   it never calls Cloudinary. The physical file stays and keeps consuming storage,
   even when deleted via the existing `/admin/media` UI. There are **zero**
   Cloudinary `destroy` calls anywhere in the codebase. The SDK (`cloudinary` v2) and
   `CLOUDINARY_API_SECRET` are already available server-side (used by
   `cloudinary-sign.ts`).
3. The usage guard already exists: `deleteMediaAction` refuses to delete a referenced
   asset and returns `{ deleted: false, usage }`.

## Decisions (confirmed)

| Topic | Decision |
|---|---|
| Cloudinary deletion | Delete the physical file from Cloudinary **and** the DB row. |
| Delete location | Add a delete button **in the picker dialog** (every photo). |
| In-use asset | **Refuse** + show **every** place it's used. (Reuse existing usage guard.) |
| Multi-location use | One photo can be used in **several** places at once (e.g. the head-teacher photo in the "sambutan" section AND as that teacher's profile photo). The guard already returns ALL usages; the UI must list every distinct location, and the user must detach the photo from ALL of them before it can be deleted. |
| Cloudinary failure | **Cloudinary-first, then DB.** `not found` → treat as success (idempotent → still delete the DB row). Any other error → abort, DO NOT delete the DB row (no reverse-orphan), surface error. |
| Usage check timing | **On delete click only** — the picker shows a delete button on all photos; the usage check happens inside `deleteMediaAction` when clicked (no per-list usage query). |
| Roles | ADMIN + EDITOR (same as the existing `deleteMediaAction`). |

### Out of scope (YAGNI)

Bulk delete, trash/restore, scheduled orphan cleanup, replace-photo, marking in-use
photos in the list up front.

## Architecture (3 layers, mirrors existing media patterns)

### 1. Cloudinary destroy helper — `src/lib/media/cloudinary-destroy.ts` (new)

```ts
export type DestroyResult = 'destroyed' | 'not_found';

export async function destroyCloudinaryAsset(
  publicId: string,
  resourceType: 'image' | 'raw',
): Promise<DestroyResult>;
```

- Uses `cloudinary.uploader.destroy(publicId, { resource_type: resourceType, invalidate: true })`.
- **CRITICAL — must call `cloudinary.config()` first.** `cloudinary-sign.ts` signs via
  `api_sign_request(params, env.CLOUDINARY_API_SECRET)` — secret passed explicitly, so
  it never needed global config. `uploader.destroy` is different: it builds an
  authenticated API call and throws `Must supply api_key` unless `cloudinary.config()`
  (or `CLOUDINARY_URL`) is set — and this project sets neither. So this helper MUST do,
  once at module load (idempotent):
  ```ts
  cloudinary.config({
    cloud_name: env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
  ```
  Without this, EVERY delete fails in production (and the test gate hides it). This is
  the #1 blocker.
- `resourceType` is derived by the caller from `MediaAsset.kind`: `image → 'image'`,
  `pdf → 'raw'` (PDFs are uploaded as Cloudinary `raw`; destroying with the wrong
  resource_type silently no-ops, so this mapping is REQUIRED).
- Cloudinary response `{ result: 'ok' }` → `'destroyed'`; `{ result: 'not found' }`
  → `'not_found'` (idempotent success). Any other result or a thrown SDK/network
  error → rethrow (the repo/action aborts and leaves the DB row intact).
- **Test gate (mirror `signCloudinaryUpload`):** when `process.env.NODE_ENV === 'test'`,
  return `'destroyed'` without any network call, so tests never hit real Cloudinary.
- `import 'server-only'` (the SDK + secret must never reach the client bundle).

### 2. Repository — `deleteMediaAsset` (media-repo.ts) gains Cloudinary deletion

```ts
export async function deleteMediaAsset(id: string): Promise<void> {
  const row = await prisma.mediaAsset.findUnique({
    where: { id }, select: { publicId: true, kind: true },
  });
  if (!row) throw Object.assign(new Error('not found'), { code: 'P2025' });
  const resourceType = row.kind === 'pdf' ? 'raw' : 'image';
  // Pass row.publicId UNCHANGED. For raw/PDF, Cloudinary's stored publicId INCLUDES
  // the .pdf extension (confirm/route.ts stores cloudinary.public_id verbatim, and
  // raw responses carry the extension) — and a raw destroy REQUIRES the
  // extension-bearing id. Do NOT strip any extension: stripping it makes every PDF
  // destroy return 'not_found' (treated as success) → the row is deleted but the PDF
  // leaks in Cloudinary forever — exactly the bug this feature fixes.
  // Cloudinary first. Throws on a real error → DB row stays (caller surfaces it).
  // 'not_found' is fine — the file is already gone; proceed to clean the row.
  await destroyCloudinaryAsset(row.publicId, resourceType);
  await prisma.mediaAsset.delete({ where: { id } });
}
```

- Cloudinary-first ordering per the decision. The existing cascade behavior is
  unchanged: `MediaUsage` rows cascade-delete, `DocumentSlot.media` SetNull.
- `forceDeleteMediaAction`'s repo path: the ADMIN-only force delete exists for
  **broken rows whose Cloudinary file is already missing**. It must still work when
  Cloudinary is unreachable. Keep `forceDeleteMediaAction` deleting the DB row +
  usage in a transaction WITHOUT calling Cloudinary (its whole purpose is the
  Cloudinary-file-missing escape hatch). It will attempt a best-effort Cloudinary
  destroy that swallows errors — OR simply skip Cloudinary (document the choice).
  **Decision: force delete attempts `destroyCloudinaryAsset` best-effort (try/catch,
  ignore any error) BEFORE the `$transaction`, then deletes the DB row + usage in the
  transaction.** The destroy is a network call — never hold a DB transaction open
  across it. This way a broken row still clears (destroy throws/`not_found` → ignored),
  and if the file does exist it's also removed.

### 3. Action — `deleteMediaAction` (media-actions.ts) — minimal change

The existing action already: checks existence, checks usage (returns
`{deleted:false, usage}` when in use), else calls `deleteMediaAsset`, audits,
revalidates. With the repo now deleting from Cloudinary, the action is correct as-is.
The only addition: a Cloudinary error now propagates out of `deleteMediaAsset` — it's
already inside `withRole`, which maps a thrown error to `{ ok:false, error }`, so the
picker/Media UI shows a failure message. No structural change; verify the audit still
only fires on success (it does — it's after `deleteMediaAsset`).

> `revalidateMediaConsumers()` already busts `media` + entity/page tags. Add
> `revalidateTag('section-photos')` so a deleted section photo overlay refreshes too
> (the new SectionPhoto overlay cache). Small, correct addition.

### 4. Picker UI — `ImagePickerModal.tsx`

Each grid item gains a delete control alongside "Pilih":

- A small delete button (🗑 / ✕) — visible per card (e.g. top-right corner overlay,
  or a secondary button under the filename next to "Pilih").
- Click → lightweight inline confirm ("Hapus foto ini?") → call
  `deleteMediaAction(m.id)` (server action, imported directly — the modal is a client
  component; server actions are importable):
  - `{ ok:true, data:{ deleted:true } }` → `void refresh()` (the deleted photo
    disappears from the grid).
  - `{ ok:true, data:{ deleted:false, usage } }` → show an inline message: "Foto ini
    sedang dipakai di: <friendly usage list>" (do NOT delete; the user detaches first).
  - `{ ok:false, error }` → inline error toast ("Gagal menghapus: <error>").
- Per-item local state: which card is `confirming` / `deleting` / showing a
  `usageMessage` or `errorMessage`. Keep it simple (a `Map<id, status>` or per-card
  state via a small child component).
- The picker is shared (mounted at the admin layout) and used by every entity form,
  the section-photo editor, and document slots. The delete button appears in all of
  them — that's desired (one consistent place to clean up).

### 5. Friendly usage labels — `src/lib/media/usage-label.ts` (new, small)

`usage` rows are `{ usedInTable, usedInId, usedInField }`, e.g.
`{ Teacher, <cuid>, photoSrc }` or `{ SectionPhoto, 'home:hero:photo', photo }`.
A pure formatter maps `usedInTable` (+ section slot key) → an Indonesian label:

```
usageLabel({ usedInTable, usedInId, usedInField }): string
  Teacher → 'Guru', Achievement → 'Prestasi', Extracurricular → 'Ekstrakurikuler',
  GalleryItem → 'Galeri', Facility → 'Fasilitas', Mading → 'Mading',
  DocumentSlot → 'Dokumen',
  SectionPhoto → per-slot human name, DISAMBIGUATED by field where a section has >1:
    'home:hero:photo'      → 'Hero Beranda'
    'home:sambutan:photo'  → 'Foto Kepala Sekolah'
    'home:about:photoMain' → 'Tentang Kami (foto utama)'
    'home:about:photoSub'  → 'Tentang Kami (foto pendukung)'
    'profil:sejarah:photo' → 'Sejarah'
    'akademik:kurikulum:photo' → 'Kurikulum'
  unknown table/slot → a sensible fallback (e.g. `${usedInTable}`).
```

Pure function (input one usage row → one label string). The picker and MediaManager
both render **one entry per usage row** (no label-level dedupe — see the multi-location
note above). MediaManager today renders raw `usedInTable #usedInId / usedInField`
(MediaManager.tsx ~line 297) — extract this helper and adopt it in BOTH (improves
MediaManager too), keeping its existing per-row list (do not collapse).

**Multi-location is the norm, not an edge case — and dedupe-by-label is UNSAFE.** A
single photo legitimately appears in multiple usage rows (e.g. head-teacher photo →
`SectionPhoto home:sambutan:photo` AND `Teacher <id> photoSrc`). Show **one line per
usage row** — do NOT dedupe by friendly label. Reason: two distinct locations can map
to the same label (`home:about:photoMain` and `home:about:photoSub` both → "Tentang
Kami"). If collapsed to one chip, the user detaches one, retries, delete still fails
(the other row remains), but the message is unchanged → dead-end loop. So:

- Render exactly as many entries as there are usage rows (`getMediaAssetUsage` returns
  all of them, deterministically ordered — no repo change).
- The label must be **disambiguated per field** so two same-section slots are
  distinguishable, e.g. "Tentang Kami (foto utama)" vs "Tentang Kami (foto pendukung)".
- Only dedupe on the exact `(usedInTable, usedInId, usedInField)` triple (which can't
  duplicate anyway — it's the unique key), never on the display label. The number of
  listed locations MUST equal the number of detach actions the user has to perform.

## Data flow

```
Picker card "Hapus" ──▶ deleteMediaAction(id)  [withRole ADMIN/EDITOR]
   exists? ──no──▶ {ok:false, error:'not found'}
   usage>0? ──yes─▶ {ok:true, deleted:false, usage}  → picker shows "dipakai di …"
   else ──▶ deleteMediaAsset(id):
              destroyCloudinaryAsset(publicId, image|raw)
                 ├ throws (network/other) ─▶ action {ok:false, error} ; DB row kept
                 └ 'destroyed' | 'not_found' ─▶ prisma.delete(row)  (cascades usage)
            audit + revalidate(media, entities, section-photos)
            ─▶ {ok:true, deleted:true} → picker refresh()
```

## Error handling

- Cloudinary `not found` → success (idempotent).
- Cloudinary network/other error → action returns `{ok:false}`, DB intact, picker
  shows retry-able error.
- In-use → `{deleted:false, usage}`, friendly list, no deletion.
- Force delete (ADMIN, broken rows) → best-effort Cloudinary, always clears DB row.

## Testing

**Unit (jest):**
- `cloudinary-destroy`: `NODE_ENV==='test'` gate returns `'destroyed'` without
  network. (Live path is integration-only / mocked.)
- `usage-label`: each `usedInTable` → expected Indonesian label; SectionPhoto slot
  keys → human names; unknown table → a sensible fallback.

**Integration (jest, real MySQL; Cloudinary module-mocked):**
- The `NODE_ENV==='test'` gate in `cloudinary-destroy.ts` short-circuits the SDK, so
  the integration test must **`jest.mock('@/lib/media/cloudinary-destroy')`** and assert
  on the args passed to `destroyCloudinaryAsset` — NOT mock the SDK (the gate makes the
  SDK unreachable). Mock seam: add the mock to the existing media-actions test (which
  already mocks `@/lib/auth/session` + seeds real MySQL MediaAsset/MediaUsage rows).
- Assert:
  - delete of an unused **image** calls `destroyCloudinaryAsset(publicId, 'image')`,
    delete of an unused **pdf** calls it with `'raw'` and the **extension-bearing**
    publicId, then removes the DB row (and cascades MediaUsage).
  - delete of an in-use asset returns `{deleted:false, usage}` and does NOT call
    destroy / does NOT remove the row.
  - mock resolving `'not_found'` still removes the DB row.
  - mock rejecting (thrown error) leaves the DB row intact and surfaces `{ok:false}`.
- The LIVE path (real `cloudinary.config()` + `uploader.destroy`) is covered separately
  like `cloudinary-sign.test.ts` does: flip `NODE_ENV` off-test and `jest.doMock('cloudinary')`
  to intercept `uploader.destroy` — asserting config is set and the call shape. Optional
  but recommended given C1 (config) was a hidden blocker.

**Build/visual:** `next build`; manual smoke — open a picker, delete an unused photo
(gone from grid + Cloudinary), try deleting an in-use photo (blocked with usage list).

## File manifest

**New:**
- `src/lib/media/cloudinary-destroy.ts`
- `src/lib/media/usage-label.ts`
- `src/__tests__/lib/media/cloudinary-destroy.test.ts`
- `src/__tests__/lib/media/usage-label.test.ts`
- (integration) extend or add `src/__tests__/integration/.../media-delete.test.ts`

**Modify:**
- `src/lib/data/repositories/media-repo.ts` — `deleteMediaAsset` calls destroy first
- `src/app/(admin)/admin/media/_actions/media-actions.ts` — force-delete best-effort
  destroy; add `revalidateTag('section-photos')`
- `src/components/admin/media/ImagePickerModal.tsx` — per-card delete + confirm +
  usage/error messages + refresh
- `src/app/(admin)/admin/media/MediaManager.tsx` — reuse `usage-label` (if it renders
  raw tables today); behavior already correct via the shared action

**Unchanged (verify):** `/api/media/*` routes, `cloudinary-sign.ts`, upload flow,
`syncPhotoUsage`, schema (no migration — MediaUsage cascade already handles cleanup).

## Risk & mitigation

- **Wrong resource_type → silent no-op leak.** Mitigated by deriving from `kind`
  (image→image, pdf→raw) and an integration assertion on the destroy arg.
- **Picker is shared everywhere** → the delete button shows in all forms. Intended;
  the usage guard prevents deleting an active photo from any of them.
- **Cloudinary down mid-delete** → row kept, user retries; no reverse orphan.
- **No migration / no schema change** → low blast radius.
- **Concurrency (two admins delete same asset):** both pass the usage check, both call
  destroy (2nd gets `not_found` → success), both call `prisma.delete`; the loser's
  delete throws `P2025` → `withRole` maps to `{ok:false, error:'not found'}`. Harmless
  (asset is gone), no corruption. Accepted as-is.
- **Rate limiting:** server actions aren't rate-limited (unlike `/api/media/*`). The
  picker now shows a delete on every card, so rapid clicks can fire many destroy calls;
  Cloudinary's own API limits would 429 (surfacing as a generic error). Accepted for a
  2-role admin tool — not adding a limiter (YAGNI). The existing
  `revalidateMediaConsumers` tag set is inherited as-is (a pre-existing partial list).
