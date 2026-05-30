# Phase 3 — Storage decision & handover groundwork

> This document captures the non-obvious storage choices Phase 3 makes so that
> the eventual handover to the school (Phase 5 deliverable) is a runbook, not a
> retrofit. It is consumed by humans, not agents — but every section is grounded
> in concrete code paths.

## Why this exists

The dev is pro-bono. Cloudinary, Hostinger VPS, and the GitHub repo all live on
the developer's personal accounts. After ~1 year the school may want to migrate
to its own infrastructure. The handover must be possible **without** giving the
school any developer credentials.

To make that possible cheap, Phase 3 commits to three rules.

---

## Rule 1 — publicId is the source of truth

`MediaAsset.publicId` is the canonical Cloudinary reference. Every consumer
(`TeacherCard`, `KalenderSection`, `TatibSection`, `MediaManager`,
`ImagePickerModal`, `DocumentSlotManager`, `PhotoPicker`) resolves a render URL
via:

```ts
cldUrl(publicId, variant) // src/lib/media/cldUrl.ts
```

`cldUrl` reads `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` at render time. The cloud
name is **never persisted to a DB row**, so a soft handover (same publicIds,
new cloud) is one env-var swap. Hard handover (re-upload to a new account,
new publicIds) only needs to `UPDATE MediaAsset SET publicId = ?, url = ?`
on each row — no other table needs to change because everything else
references MediaAsset.id (which is a CUID that survives).

### Where `MediaAsset.url` fits

The column is a denormalized **cache** populated at `/api/media/confirm` time.
Render code MUST NOT read it; it exists for two practical purposes:

1. `/admin/media` grid + ImagePicker grid display thumbnails via
   `cldUrl(publicId, 'card')` — `MediaAsset.url` would be too high-res. The
   grid uses publicId, not `url`.
2. Audit-log readability (an admin can paste the cached URL into a browser
   to confirm "yes, that's the file I just uploaded").

Phase 3 enforces "render never reads `MediaAsset.url`" by code review;
Chunk 10.2 brands `PublicMediaAsset.url` as `CloudinaryCachedUrl` so a future
contributor has to opt in via `String(asset.url)` to get a raw string.

## Rule 2 — Teacher.photoSrc is a publicId, not a URL

When `Teacher.photoKind === 'url'`, the `photoSrc` column stores a Cloudinary
publicId (charset `[a-zA-Z0-9_/-]+`, no `://`, no leading `/`). The Zod
validator `photoSchema` in `src/lib/validation/schemas/shared.ts` rejects
URL-shaped values at write time, and Task 0 of Phase 3 verified zero
existing rows had `photoKind='url'` at the time the validator tightened.

This avoids the worst migration outcome: handover requiring a per-row
URL rewrite across every teacher.

## Rule 3 — DocumentSlot.mediaId is an FK; URLs are derived

`DocumentSlot.mediaId` is a foreign key to `MediaAsset.id`. The public
sections (`KalenderSection`, `TatibSection`) render
`cldUrl(documentSlot.media.publicId, 'pdf')`. Same env-swap story.

When `documentSlot.media` is `null` (no PDF attached or the row is missing),
the download CTA is **not rendered** — a graceful fallback that closes the
long-standing spec gap where static configs hardcoded `/docs/...pdf` paths
that didn't exist on disk.

---

## Phase 5 handover script — interface designed now, built later

The actual migrate-media script is Phase 5 scope (needs a real second
Cloudinary account to test against). Its signature is captured here so
Phase 5 ships a runbook, not a redesign:

```ts
// scripts/handover-migrate-media.ts (Phase 5)
//
// Re-uploads every MediaAsset row from the source Cloudinary account to a
// target account, keyed by sha256 hash so the script is idempotent and
// resumable. Writes a manifest sidecar and in --apply mode updates
// MediaAsset.publicId + MediaAsset.url in the DB.
//
// Usage:
//   ts-node scripts/handover-migrate-media.ts --dry-run
//   ts-node scripts/handover-migrate-media.ts --apply
//   ts-node scripts/handover-migrate-media.ts --resume --apply

interface HandoverOptions {
  dryRun: boolean;        // default true; --apply flips to false
  resume: boolean;        // reads handover-manifest.json, skips done hashes
  manifestPath: string;   // default './handover-manifest.json'
  concurrency: number;    // default 4; Cloudinary rate-limit friendly
  batchSize: number;      // default 50; DB updates in transactions
}

interface ManifestEntry {
  hash: string;
  sourcePublicId: string;
  targetPublicId: string;
  targetUrl: string;
  bytes: number;
  migratedAt: string;     // ISO
  status: 'done' | 'failed';
  error?: string;
}

interface HandoverManifest {
  startedAt: string;
  sourceCloudName: string;
  targetCloudName: string;
  entries: ManifestEntry[];
}
```

## Phase 5 HANDOVER.md outline

Living in `docs/HANDOVER.md`, written in Indonesian for the school's developer:

```
# Panduan Serah Terima — SMPN 3 Kresek Website

0. Ringkasan
   - Yang berpindah (kode, DB, media Cloudinary, domain, env vars)
   - Yang tidak berpindah (akun developer ditutup setelah sukses)
   - Estimasi durasi: ~2 jam dengan akses siap

1. Prasyarat
   - Akun Cloudinary baru (free tier OK)
   - Server PostgreSQL (Neon / Supabase / VPS)
   - Hosting Next.js (Vercel free tier) atau VPS Node 20+
   - Domain (opsional)
   - Akses transfer GitHub repo

2. Transfer Repo Git
3. Migrasi Database (pg_dump → pg_restore)
4. Migrasi Media Cloudinary
   4a. Opsi soft (env-swap, transisi sementara)
   4b. Opsi hard (script handover --apply)
   4c. Verifikasi (/admin/media thumbnails)

5. Tukar Env Vars
   - DATABASE_URL, CLOUDINARY_*, NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
     AUTH_SECRET (rotasi), AUTH_URL (domain baru)

6. Reset Akun Admin (seed:admin --reset)
7. Deploy + smoke test
8. Troubleshooting
9. Kontak & Lisensi MIT
```

The 30-day window in section 4c (keep developer's Cloudinary account live
for rollback) is critical — once the school confirms the new account works,
the developer can close their account safely.

## What Phase 3 does NOT decide

- The actual migrate-script implementation. Designed but not built.
- HANDOVER.md prose. Outlined but not written.
- The orphan-cleanup cron (Cloudinary publicIds older than 7 days with no
  MediaAsset row). Spec puts it in Phase 3, plan defers to Phase 5 because
  the cron lives on the VPS and depends on a deployment that doesn't exist
  yet. Acceptable trade-off because the orphans accumulate slowly (only on
  failed uploads where /confirm didn't complete) and don't affect correctness.

## Why these choices are reversible

If a year from now the school doesn't actually want to migrate, none of
these decisions force any extra work. publicId-as-truth is simpler than
URL-as-truth anyway; `cldUrl()` is the only render path either way; the
photoSrc regex is just defense-in-depth. The cost is paid once, in Phase 3,
to make Phase 5 cheap.
