# Admin Dashboard & CMS Design — SMPN 3 Kresek

**Status:** Draft for review
**Date:** 2026-05-26
**Author:** Design session (brainstorming with stakeholder)
**Context:** Phase berikutnya setelah Phase 0-2 (static config-driven site selesai). Feedback dari sekolah: (1) hapus CTA "Info PPDB" diganti "Kontak", (2) butuh admin dashboard untuk CRUD landing page.

---

## 1. Summary

Membangun admin dashboard custom dengan kemampuan **content-only CRUD penuh** (semua wording, foto, dan entity bisa diedit oleh staff sekolah non-developer) dengan UX **inline editing à la Notion/Framer** untuk konten halaman + traditional dashboard form untuk CRUD entity.

Sistem mempertahankan arsitektur `ContentProvider` yang sudah ada di project, mengisi `ApiContentProvider` stub menjadi implementasi penuh berbasis Postgres + Prisma. Public site migrate dari static export ke Next.js dengan ISR + on-demand revalidation untuk real-time publishing.

**Stakeholder profile**: 1-2 power user (guru TIK / staff TU) sebagai admin + beberapa kontributor guru. Role-based: ADMIN + EDITOR.

**Scope keputusan utama**:
- Editing scope: content-only (layout/struktur halaman fixed, tapi semua text/foto/entity bisa diedit)
- Hosting: Hostinger VPS Indonesia (sudah dimiliki)
- Publishing: real-time (SSR/ISR)
- Editor UX: inline editing (Notion/Framer-style) untuk page content + traditional CRUD panel untuk entity
- Security level: basic hygiene (bukan kelas bank), bcrypt + standard NextAuth

---

## 2. Goals & non-goals

### Goals

1. Staff sekolah non-developer bisa edit semua text (judul, paragraf, label, FAQ, deskripsi guru, dll) tanpa sentuh kode
2. Staff bisa CRUD semua entity: guru, prestasi, ekskul, mata pelajaran, FAQ, gallery, fasilitas, struktur organisasi
3. Staff bisa ganti foto guru dan PDF kalender akademik / tata tertib via UI
4. Perubahan langsung live (real-time, < 5 detik delay)
5. UX admin minimal friction: inline editing terasa seperti edit Notion, bukan isi form database
6. Multi-user safe: dua admin edit bersamaan tidak corrupt data
7. Zero vendor lock-in: data tetap milik sekolah, mudah pindah hosting kalau perlu
8. CTA "Info PPDB" dihapus, diganti "Kontak"
9. Mempertahankan code quality existing: TypeScript strict, type-safe end-to-end, tested

### Non-goals (YAGNI)

- Full WYSIWYG drag-and-drop layout builder (à la WordPress Elementor)
- Multi-language / i18n
- Multi-tenant (cuma 1 sekolah)
- Komentar/diskusi antar editor di admin
- Scheduled publishing / draft-publish workflow
- Image cropping/editing dalam app
- Full content versioning dengan rollback per perubahan
- 2FA / SSO / password complexity policy
- Email-based password reset (admin reset manual via UI)
- Daily automated backup ke cloud (cukup Hostinger snapshot)
- Sentry, UptimeRobot, monitoring berbayar
- Manual JSON export

---

## 3. Architecture

### High-level layers

```
┌─────────────────────────────────────────────────────────────┐
│                    Public Website                            │
│  Next.js Server Components → ContentProvider → Postgres     │
│  (ISR + on-demand revalidation saat admin publish)          │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ on-demand revalidate
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Admin App (/admin/*)                      │
│  /admin/login                                                │
│  /admin/dashboard                                            │
│  /admin/edit/<page>   ← inline editor di public page         │
│  /admin/entities/<x>  ← CRUD panel (tabel + form)            │
│  /admin/media         ← upload & manage foto/PDF             │
│  /admin/users         ← ADMIN only                           │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ Server Actions / API routes
                              │
┌─────────────────────────────────────────────────────────────┐
│              Data Layer (Postgres via Prisma)                │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │
┌─────────────────────────────────────────────────────────────┐
│              File storage: Cloudinary                        │
│  Foto + PDF, free tier 25GB                                  │
└─────────────────────────────────────────────────────────────┘
```

### Changes from current architecture

- `next.config.mjs`: hapus `output: 'export'` → SSR/ISR aktif
- `app/(admin)/layout.tsx`: ganti dari `notFound()` jadi proper admin shell dengan auth guard
- `ApiContentProvider`: dari stub jadi real implementation (Prisma client)
- `StaticContentProvider`: **dipertahankan** sebagai seed source — saat first deploy ke DB, kita seed dari config yang sudah ada (tidak buang kerja Phase 0-2)
- `src/config/types.ts` tetap menjadi single source of truth untuk shape data (digunakan untuk Zod schemas dan Prisma model alignment)

---

## 4. Data model

### Strategy: 2 jenis konten

**Page content** (semi-structured text/asset per section) → JSONB per page section, schema-validated oleh Zod. Cocok untuk hero, sambutan kepsek, visi-misi, deskripsi section.

**Entities** (list of records dengan CRUD) → tabel relational normal, satu tabel per entity. Cocok untuk guru, prestasi, ekskul, dll yang butuh query/filter/order.

### Prisma schema

```prisma
// === Auth & users ===
model User {
  id                  String    @id @default(cuid())
  email               String    @unique
  passwordHash        String
  name                String
  role                Role
  mustChangePassword  Boolean   @default(false) // true setelah admin reset password
  passwordChangedAt   DateTime?
  createdAt           DateTime  @default(now())
  lastLoginAt         DateTime?
  sessions            Session[]
}

enum Role { ADMIN EDITOR }

model Session {
  id        String   @id
  userId    String
  expiresAt DateTime
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

// === Page content (JSONB-based) ===
model PageSection {
  id         String   @id @default(cuid())
  pageKey    String
  sectionKey String
  data       Json
  updatedAt  DateTime @updatedAt
  updatedBy  String

  @@unique([pageKey, sectionKey])
}

model SiteConfig {
  id        String   @id @default("singleton")
  data      Json
  updatedAt DateTime @updatedAt
  updatedBy String
}

model Navigation {
  id        String   @id @default("singleton")
  items     Json
  updatedAt DateTime @updatedAt
  updatedBy String
}

// === Entities (CRUD penuh) ===
model Teacher {
  id          String   @id @default(cuid())
  name        String
  position    String
  badge       String?
  category    String   // "pimpinan" | "guru" | "tu" | "wakasek"
  photoKind   String   // "gradient" | "url"
  photoFrom   String?
  photoTo     String?
  photoEmoji  String?
  photoSrc    String?
  photoAlt    String?
  order       Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Achievement {
  id         String   @id @default(cuid())
  year       String
  title      String
  recipient  String
  organizer  String
  level      String
  icon       String
  order      Int      @default(0)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

model Extracurricular {
  id           String   @id @default(cuid())
  name         String
  category     String
  description  String
  pembina      String
  schedule     String
  achievement  String?
  icon         String
  order        Int      @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model Subject {
  id        String   @id @default(cuid())
  grade     Int
  name      String
  hours     Int
  teacher   String?
  order     Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Faq {
  id        String   @id @default(cuid())
  question  String
  answer    String
  category  String
  order     Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model GalleryItem {
  id        String   @id @default(cuid())
  title     String
  caption   String?
  photoSrc  String
  photoAlt  String
  category  String?
  order     Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Facility {
  id          String   @id @default(cuid())
  name        String
  description String
  category    String
  icon        String
  photoSrc    String?
  order       Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model OrganizationMember {
  id        String                @id @default(cuid())
  name      String
  role      String
  parentId  String?
  parent    OrganizationMember?   @relation("OrgTree", fields: [parentId], references: [id], onDelete: SetNull)
  children  OrganizationMember[]  @relation("OrgTree")
  order     Int                   @default(0)
  createdAt DateTime              @default(now())
  updatedAt DateTime              @updatedAt
}

// === Media ===
model MediaAsset {
  id          String         @id @default(cuid())
  kind        String         // "image" | "pdf"
  url         String
  publicId    String         @unique
  hash        String         @unique // SHA-256 untuk dedup
  alt         String?
  filename    String
  sizeBytes   Int
  mimeType    String
  width       Int?
  height      Int?
  uploadedBy  String
  createdAt   DateTime       @default(now())
  usages      MediaUsage[]
}

model MediaUsage {
  id          String     @id @default(cuid())
  mediaId     String
  usedInTable String     // "page_section" | "teacher" | "gallery_item" | dst
  usedInId    String
  usedInField String
  media       MediaAsset @relation(fields: [mediaId], references: [id], onDelete: Cascade)

  @@unique([mediaId, usedInTable, usedInId, usedInField])
  @@index([mediaId])
  @@index([usedInTable, usedInId])
}

model DocumentSlot {
  id        String   @id // "kalender-akademik" | "tata-tertib"
  mediaId   String?
  updatedAt DateTime @updatedAt
  updatedBy String?
}

// === Audit ===
model AuditLog {
  id        String   @id @default(cuid())
  userId    String
  action    String   // "update_section" | "create_teacher" | "delete_faq" | dst
  target    String   // "page:home:hero" | "teacher:abc123"
  metadata  Json?
  createdAt DateTime @default(now())

  @@index([userId, createdAt])
  @@index([target, createdAt])
}
```

### Design rationale

- **JSONB untuk page section**: admin bisa edit wording sekecil apapun tanpa perlu migration kolom baru. Zod validate shape sebelum write.
- **Tabel terpisah untuk entity**: CRUD, ordering, search, filter optimal.
- **`order` field**: drag-reorder support.
- **`MediaAsset` + `MediaUsage`**: tracking "dipakai di mana saja" untuk safe delete.
- **`hash` SHA-256 unique** di MediaAsset: dedup, hemat storage.
- **Audit log minimal**: cukup "siapa edit apa kapan" untuk troubleshooting.
- **Soft delete TIDAK dipakai** (per keputusan stakeholder) — hard delete dengan modal konfirmasi yang minta ketik nama untuk konfirmasi.

---

## 5. Authentication & authorization

### Stack

- NextAuth.js v5 Credentials provider (email + password)
- bcrypt (cost 10) untuk password hashing
- JWT session, httpOnly + secure cookie, masa hidup 7 hari sliding renewal
- Prisma Adapter untuk store session di DB

### Roles

| Resource | ADMIN | EDITOR |
|---|---|---|
| Page sections, entity CRUD, media, document slot | ✅ | ✅ |
| SiteConfig & Navigation | ✅ | Read-only |
| User management | ✅ | ❌ |
| Audit log: per-page history drawer (Phase 4) | ✅ | ✅ untuk halaman ybs |

**Catatan**: tidak ada dedicated audit-log viewer page di scope. Audit history hanya muncul lewat "History drawer" per-page di inline editor (Phase 4). Kalau ADMIN butuh trace lebih dalam, query langsung DB.

### Authorization (3 lapis)

1. **Middleware** — cek session ada di edge, redirect ke login kalau tidak ada
2. **Layout `app/(admin)/layout.tsx`** — re-verify session + load role, 404 kalau invalid
3. **Server Actions / API routes** — `requireRole(...)` helper di setiap mutation

### Security hygiene

- ✅ Rate limit login: in-memory token bucket (5 fail / 15 menit per IP)
- ✅ Password min 8 karakter
- ✅ HTTPS cookie + httpOnly + sameSite=lax (NextAuth default)
- ✅ CSRF protection (NextAuth + Server Actions Next.js 15 default)
- ✅ Zod validation di setiap input
- ✅ HTML sanitize dengan DOMPurify untuk rich text fields
- ✅ File upload validation (MIME magic bytes, max size)
- ✅ Prisma parameterized queries
- ✅ Audit log ringan

### Edge cases & race conditions

1. **Concurrent edit dua admin di section yang sama** → optimistic locking dengan `updatedAt`. Save kirim `expectedUpdatedAt`, mismatch → modal "Konten telah diubah user lain. [Pakai versi saya] [Pakai versi terbaru] [Bandingkan]"
2. **Session expired saat edit** → autosave draft ke localStorage, redirect login dengan `returnUrl`, restore draft setelah login
3. **Upload gagal di tengah** → frontend retry 2x exponential backoff, kalau tetap gagal tampilkan tombol retry manual
4. **User dihapus saat punya session aktif** → middleware fail → redirect login

### Password reset

Admin manual: ADMIN buka `/admin/users/<id>` → klik "Reset password" → generate password sementara → tampilkan sekali (modal) → admin kasih ke user via WhatsApp. Server set `User.mustChangePassword = true`. Saat user login berikutnya, middleware/login flow detect flag dan force redirect ke `/admin/change-password` sampai user submit password baru (clear flag + update `passwordChangedAt`).

---

## 6. Inline editor (UX & implementation)

### Konsep utama

Admin tidak buka halaman editor terpisah. Mereka **buka URL website asli** (misal `/profil`), klik tombol "Edit mode" di toolbar, seluruh halaman jadi editable in-place. Hover teks → outline biru → klik → contentEditable → ketik → autosave.

### Routes & modes

```
Public:        /profil                       → mode VIEW
Admin edit:    /admin/edit/profil            → mode EDIT (login required)
Admin entity:  /admin/entities/teachers      → CRUD panel (tabel + form)
```

Saat `/admin/edit/profil`:
- Komponen sama dengan `/profil` di-render
- Dibungkus `<EditModeProvider>` inject context `{ editable: true, role, userId }`
- Setiap field text/image dibungkus `<Editable>` yang switch behaviour berdasarkan context

### `<Editable>` component API

```tsx
<Editable
  field="hero.titleLine1"
  pageKey="home"
  sectionKey="hero"
  type="text"           // "text" | "richtext" | "image" | "link"
  value={hero.titleLine1}
  maxLength={80}
>
  {(value) => <h1>{value}</h1>}
</Editable>
```

**Note tentang `type="link"`**: di MVP, link editing dibutuhkan terutama untuk SiteConfig (URL sosmed) dan dalam rich-text inline. Selama planning Phase 4, konfirmasi surface tepat mana yang butuh structured link picker vs cukup edit URL sebagai plain text di rich-text toolbar. Kalau ternyata tidak ada surface yang butuh struktur `{url, label}` terpisah, `type="link"` bisa di-drop dan disisakan untuk v2.

Behaviour:
- **View mode** → render children pure, zero overhead
- **Edit mode** + hover → outline biru 1px dotted, kursor pointer
- **Edit mode** + click:
  - `type="text"` → contentEditable + character counter (kalau maxLength)
  - `type="richtext"` → floating toolbar (bold, italic, link, list) + contentEditable
  - `type="image"` → buka image picker modal
  - `type="link"` → popover dengan input URL + label
- **Blur / Enter (text only)** → autosave (debounced 800ms)
- **Esc** → discard, revert
- **Cmd/Ctrl+Z** → undo (per field, in-memory history)

### `<EditableList>` untuk repeating items

```tsx
<EditableList
  field="programs"
  pageKey="home"
  sectionKey="programs"
  items={programs}
  minItems={1}
  maxItems={6}
  renderItem={(item, idx) => <ProgramCard ... />}
/>
```

Edit mode: hover item → drag handle + delete + duplicate. Drag reorder via dnd-kit. Tombol "+ Tambah" di akhir list.

### Floating top toolbar

```
🟢 Mode Edit • Profil      Disimpan otomatis • 2 detik lalu
[↶ Undo] [↷ Redo]  [👁 Preview]  [📜 Riwayat]  [✕ Keluar]
```

### Image picker modal

Tab: Library | Upload baru | Gradient. Wajib alt text. Tab "Gradient" untuk slot yang pakai gradient placeholder (sesuai schema `Photo` discriminated union).

### Entity CRUD panel

`/admin/entities/<entity>`:
- Tabel dengan search, filter, drag-reorder (dnd-kit)
- Klik "Edit" → side drawer slide-in dari kanan dengan form lengkap
- Form fields auto-generated dari Zod schema (react-hook-form + Zod resolver)
- Autosave per-field saat blur (sama feel dengan inline editor)
- Inline validation real-time + error message di bawah field
- Tombol "⋯" per row: Duplicate, Delete (modal konfirmasi ketik nama), View on site

### Autosave engine

```
1. User ketik → setLocal(newValue) → UI langsung update
2. Debounce 800ms → trigger save mutation (Server Action)
3. Server: validate Zod → cek expectedUpdatedAt → merge JSONB → revalidate
4. Client receive:
   - ok → update lastSavedAt status
   - conflict (409) → reconciliation modal
   - validation error → field merah + inline error
   - network error → queue retry 3x exponential backoff, kalau gagal → manual retry button
```

Edge cases dihandle:
- User offline → indicator "⚠ Offline", queue, auto-resync saat online
- User close tab dengan unsaved change → `beforeunload` warning
- User refresh saat draft belum kekirim → recover dari localStorage
- Race: dua tab user yang sama → BroadcastChannel sync
- Quick succession edit → debounce + cancel in-flight

### Validation per field type

- **Title** → trim, no newline, length 3-120
- **Body text** → max length per field, hapus zero-width chars
- **Email** → format check
- **Phone** → format Indonesia (08xx atau +62)
- **URL** → http/https only, no `javascript:`
- **Image alt** → required, min 3 char
- **Rich text** → DOMPurify whitelist: `<p> <strong> <em> <ul> <ol> <li> <a> <br>`. No script/iframe/style.

---

## 7. File storage & media

### Cloudinary (free tier 25GB)

**Kenapa Cloudinary**: auto-optimize (WebP/AVIF), CDN global, transformasi URL gratis, signed direct upload (hemat server bandwidth), durable.

### Upload flow (direct-to-Cloudinary, signed)

```
1. Client click upload di image picker
2. Client compute SHA-256 hash
3. POST /api/media/sign-upload (hash, size, mime)
4. Server:
   - cek auth (ADMIN | EDITOR)
   - cek hash sudah ada? → return existing MediaAsset, skip
   - validate size & mime
   - generate signed params (timestamp + signature)
   - return { signature, timestamp, apiKey, cloudName, folder, publicId }
5. Client upload langsung ke Cloudinary
6. Cloudinary return { url, publicId, bytes, format, width, height }
7. Client POST /api/media/confirm (response Cloudinary)
8. Server:
   - verify URL dari Cloudinary domain
   - simpan ke MediaAsset
   - return mediaId
```

### Validation

```ts
IMAGE: { maxSize: 10MB, mimes: [jpeg, png, webp], maxDim: 4000x4000 }
PDF:   { maxSize: 25MB, mimes: [pdf], maxPages: 200 }
```

### Media library `/admin/media`

Grid dengan search, filter (Semua / Foto / PDF), urutkan. Klik item → drawer kanan: preview, metadata, alt text edit, **"Dipakai di N tempat"** list, Copy URL, Hapus (block kalau masih dipakai, force kalau ADMIN dengan extra confirm).

### URL transformasi wrapper

```ts
function cldUrl(publicId: string, variant: 'avatar' | 'card' | 'hero'): string {
  const transforms = {
    avatar: 'c_fill,w_200,h_200,q_auto,f_auto',
    card:   'c_fill,w_400,q_auto,f_auto',
    hero:   'c_fill,w_1600,q_auto,f_auto',
  };
  return `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/image/upload/${transforms[variant]}/${publicId}`;
}
```

### PDF slots (kalender akademik & tata tertib)

`DocumentSlot` table. Di `/admin/edit/akademik` ada `<EditableDocument slot="kalender-akademik">`. Kalau `mediaId` null, tombol unduh **disembunyikan** di public (graceful fallback).

### Orphan cleanup

Cron harian 03:00 WIB (via crontab di Hostinger VPS): hapus dari Cloudinary `publicId` yang tidak ada di MediaAsset table dan umur >1 jam. Setup crontab masuk ke Phase 3 deliverable (lihat Section 10).

### Security checks

- Signed upload, secret tidak ke client
- MIME magic bytes verify
- Folder strict `smpn3-kresek/`
- Filename randomized (cuid)
- Cloudinary URL whitelist di `next.config.mjs` `images.remotePatterns`
- Alt text wajib

---

## 8. Publish flow, ISR & deployment

### Rendering strategy: ISR + on-demand revalidation

```
1. Request pertama /profil → render dari DB → cache HTML
2. Request berikutnya → serve cache (50ms)
3. Admin save → server action → revalidatePath('/profil') + revalidateTag(...)
4. Request berikutnya → re-render dengan data terbaru → cache lagi
```

### Cache tagging

| Tag | Invalidate saat | Affect |
|---|---|---|
| `site-config` | Edit nama sekolah, kontak, sosmed | Semua page (footer, navbar) |
| `navigation` | Edit menu | Semua page |
| `page:home`, `page:profil`, ... | Edit JSONB section | Page ybs |
| `teachers` | CRUD guru | /profil + /home |
| `achievements` | CRUD prestasi | /profil + /home |
| `extracurriculars` | CRUD ekskul | /fasilitas + /home |
| `subjects` | CRUD mapel | /akademik |
| `faqs` | CRUD FAQ | /kontak |
| `gallery` | CRUD gallery | /home + /fasilitas |
| `facilities` | CRUD fasilitas | /fasilitas |
| `documents` | Ganti PDF | /akademik + /fasilitas |

### Race condition mitigation

1. Cache key versioning dengan global `max(updatedAt)` per table
2. Read-after-write: `await prisma.find` SETELAH update SEBELUM revalidate (commit visibility)
3. Post-save redirect dengan `?t=<timestamp>` untuk bypass cache pada verifikasi visual

### Server Actions vs API Routes

- **Server Actions**: mutation dari React (CSRF built-in, type-safe)
- **API Routes**: webhook (Cloudinary callback), cron triggers, file upload sign, health check

### Error boundaries

Per-page: `loading.tsx` + `error.tsx` + `not-found.tsx`. Per-section: `<ErrorBoundary fallback={<SectionFallback />}>` supaya 1 section gagal tidak crash whole page.

### Database

- Prisma + Postgres
- Migration: `prisma migrate deploy` di CI sebelum app start
- Connection pooling: PgBouncer kalau perlu (Hostinger VPS biasanya single Node, default Prisma pool 10 cukup)
- Backward-compatible migrations

### Seeding

Idempotent seed dari `src/config/pages/*.ts` ke DB saat first deploy. Skip kalau row sudah ada.

### Backup & DR (lightweight)

- Hostinger snapshot mingguan (enable di control panel, $0 effort code)
- Hard delete dengan modal konfirmasi ketik nama (cegah accident)
- Audit log untuk trace siapa-edit-apa-kapan

### Deployment: Hostinger VPS (Indonesia, sudah dimiliki)

Setup:
- Node 22.x via nvm
- PM2 untuk process management
- Nginx reverse proxy + Let's Encrypt SSL
- Postgres lokal di VPS
- Cron via crontab

### CI/CD: GitHub Actions

**Deploy mechanism**: SSH-based deploy via GitHub Actions `appleboy/ssh-action`. Workflow connect ke VPS dengan SSH key (disimpan di GitHub Secret), execute deploy script di VPS yang melakukan: `git pull` → `npm ci` → `prisma migrate deploy` → `npm run build` → `pm2 reload`. Dipilih atas rsync karena lebih atomik (kalau build fail di VPS, app lama tetap jalan) dan tidak butuh self-hosted runner.

```yaml
on: [pull_request, push to main]

jobs:
  ci: lint + typecheck + test + build
  e2e: Playwright headless
  deploy (main only):
    - ssh-action ke VPS
    - jalankan /opt/smpn3/deploy.sh
        ↳ git pull origin main
        ↳ npm ci
        ↳ npx prisma migrate deploy
        ↳ npm run build
        ↳ pm2 reload smpn3
```

### Env vars

```
DATABASE_URL=postgres://...
AUTH_SECRET=<32 char random>          # generate: openssl rand -base64 32
AUTH_URL=https://smpn3kresek.sch.id    # NextAuth v5 naming (BUKAN NEXTAUTH_URL)
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
NEXT_PUBLIC_DATA_SOURCE=api
```

Validation: `@t3-oss/env-nextjs` — app refuse start kalau env tidak lengkap.

### Pre-launch checklist

- [ ] DB migrate sukses
- [ ] Seed dari config existing
- [ ] Create 1 ADMIN account
- [ ] Smoke test: login → edit → publish → verify
- [ ] Health check return 200
- [ ] Cloudinary upload test
- [ ] Lighthouse ≥90
- [ ] DNS + SSL aktif
- [ ] Old static export di Cloudflare Pages sebagai fallback 1 minggu transisi

---

## 9. Testing strategy

### Pyramid

- **~60 unit tests**: validators (Zod), password hash, rate limiter, `requireRole`, `cldUrl`, file hash, MIME validator, autosave debouncer, optimistic lock helper, DOMPurify, `<Editable>` states, `<EditableList>` reorder
- **~30 integration tests** (Jest + test postgres): auth flow, server actions per entity, optimistic lock conflict, role permission, cache revalidation, audit log creation, DB constraints
- **~10 E2E tests** (Playwright): public smoke, login flow, edit hero → verify public, CRUD guru, upload foto → assign, replace PDF, EDITOR permission, concurrent edit conflict, session expired, CTA PPDB→Kontak

### Infrastructure

- Jest (existing)
- Playwright + CI matrix
- Test database: `docker-compose.test.yml` postgres on 5433, transaction rollback per test
- `@faker-js/faker` untuk fixtures
- MSW untuk mock Cloudinary

### Coverage thresholds

- `src/lib/`: ≥70%
- `src/components/admin/`: ≥60%
- Public organism components: di-cover oleh E2E

---

## 10. Implementation roadmap

6 fase, masing-masing shippable increment, tidak big-bang.

### Phase 0 — Foundation (3-4 hari)

Switch ke server runtime, setup auth & DB.

- Hapus `output: 'export'`
- Setup Prisma + Postgres
- Schema awal: User, Session, AuditLog
- NextAuth v5 + Credentials + bcrypt
- Middleware auth guard
- `requireRole` helper + tests
- Login page UI
- Seed 1 ADMIN account
- CI: Playwright, postgres service
- Deploy ke Hostinger VPS, health check

**Deliverable**: bisa login ke `/admin/dashboard` (kosong), public site tetap jalan.

### Phase 1 — Data migration (3-4 hari)

Data DB jadi source of truth.

- Schema lengkap semua entity & section
- Zod schemas mirror `src/config/types.ts`
- Seed idempotent dari config existing → DB
- Implement `ApiContentProvider` penuh dengan `unstable_cache` + tags
- Switch `NEXT_PUBLIC_DATA_SOURCE=api`
- CTA fix: hapus PPDB, ganti Kontak
- **Capture Playwright screenshot baselines** dari static export (dijalankan SEBELUM switch ke api) sebagai reference
- Visual parity verify (Playwright screenshot diff vs baseline)

**Deliverable**: public site visually identical, data sudah dari DB.

### Phase 2 — Admin shell & entity CRUD (5-6 hari)

CRUD via traditional dashboard.

- Admin layout dengan sidebar
- Dashboard overview
- Generic CRUD scaffolding (reusable)
- Per-entity panel: Teacher, Achievement, Extracurricular, Subject, FAQ, GalleryItem, Facility, OrganizationMember
- Drag-reorder (dnd-kit)
- Form auto-generated dari Zod
- Hard delete dengan confirmation modal
- Audit log per mutation
- User management (ADMIN only)
- Integration tests

**Deliverable**: admin bisa CRUD semua entity. Sudah cukup untuk launch v1.

### Phase 3 — Media library (3-4 hari)

- Cloudinary setup + env vars
- Sign upload endpoint
- Confirm endpoint dengan dedup hash
- Media library UI
- Image picker modal
- PDF picker untuk DocumentSlot
- "Dipakai di N tempat" via `MediaUsage`
- Delete dengan check usage
- Validation (MIME, size, magic bytes)
- `cldUrl` wrapper
- **Setup crontab di VPS untuk orphan cleanup harian** (03:00 WIB)
- Tests + Playwright upload flow

**Deliverable**: upload foto guru baru, ganti PDF kalender, semua reflect di public.

### Phase 4 — Inline editor (6-8 hari) ⭐

- `EditModeProvider`
- `<Editable>` text + richtext + image + link
- `<EditableList>` + dnd-kit reorder
- Floating top toolbar
- Autosave engine (debounce + queue + retry + offline)
- Optimistic locking + conflict modal
- localStorage draft backup
- BroadcastChannel sync antar tab
- Wrap public page components dengan `<Editable>`
- Edit routes `/admin/edit/<page>`
- History drawer (audit log per page)
- Tests: unit + integration + E2E

**Deliverable**: admin edit inline di page → otomatis tersimpan & live.

### Phase 5 — Polish & launch (3-4 hari)

- Loading & error boundaries semua page
- Empty states
- Help text & tooltips
- Admin user guide (markdown di `/admin/help`)
- Accessibility audit (keyboard, ARIA, focus)
- Lighthouse ≥90 public, ≥85 admin
- Browser compat (Chrome, Safari, Edge, mobile)
- Pre-launch checklist
- Training session sekolah (1 jam) + recording

**Deliverable**: production-ready, sekolah pakai mandiri.

### Total: 23-30 hari kerja (~5-6 minggu kalender)

Early ship possible: setelah Phase 0-3 (~17 hari), admin dashboard fully functional dengan CRUD form. Inline editor v2.

---

## 11. File inventory

### New

- `prisma/schema.prisma` + migrations
- `src/lib/auth/*`
- `src/lib/data/ApiContentProvider.ts` (replace stub)
- `src/lib/data/repositories/*` (per entity)
- `src/lib/validation/schemas/*`
- `src/lib/security/*`
- `src/lib/media/cloudinary.ts`
- `src/lib/server-actions/*`
- `src/app/(admin)/admin/*` (banyak route)
- `src/components/admin/*` (Editable, EditableList, ImagePicker, dll)
- `src/middleware.ts`
- `playwright/` config + tests
- `docker-compose.test.yml`

### Modified

- `next.config.mjs` (hapus export, tambah Cloudinary domain)
- `src/app/(admin)/layout.tsx`
- `src/app/<page>/page.tsx` × 5 (wrap editable content)
- `src/components/organisms/**` (wrap field dengan `<Editable>`)
- `package.json` (deps: next-auth, prisma, bcrypt, zod, react-hook-form, dnd-kit, dompurify, cloudinary, t3-env, faker)
- `README.md`

### Kept

- `src/config/types.ts` — single source of truth shape
- `src/config/pages/*.ts` — sumber seed
- `src/components/atoms/`, `molecules/`
- `src/lib/hooks/*`
- `src/lib/utils/*`

---

## 12. Risk register

| Risk | Likelihood | Impact | Mitigasi |
|---|---|---|---|
| Inline editor complexity > estimasi | Sedang | Sedang | Ship Phase 0-3 sebagai v1, inline editor v2 |
| Hostinger VPS resource limits | Rendah | Sedang | Monitoring manual, upgrade plan kalau perlu |
| Cloudinary quota terlewati | Sangat rendah | Rendah | Upgrade atau migrate ke S3 |
| Admin tidak terbiasa pakai sistem | Sedang | Tinggi | Phase 5 training + recorded tutorial; tooltip & help text |
| Migration data loss | Rendah | Tinggi | Seed idempotent + visual regression test |
| Postgres downtime | Rendah | Tinggi | Hostinger snapshot mingguan; cached HTML graceful degradation |

---

## 13. Open questions

Tidak ada pada saat spec ditulis — semua keputusan stakeholder sudah confirmed. Pertanyaan future yang mungkin muncul saat implementasi akan di-track di GitHub Issues.

---

## 14. Planning guidance

Spec ini cakupannya **program-level** (6 fase yang masing-masing shippable). Implementation plan **TIDAK** dibuat sebagai satu mega-plan. Sebagai gantinya:

- Plan pertama target **Phase 0 (Foundation)** saja.
- Setelah Phase 0 selesai dan di-merge, plan Phase 1 dibuat dengan konteks baru (DB sudah live, dst).
- Demikian seterusnya sampai Phase 5.

Rationale: setiap fase punya risiko & dependency berbeda, dan keputusan implementasi fase berikutnya bisa berubah berdasarkan apa yang dipelajari di fase sebelumnya. One-plan-per-phase memberi feedback loop yang sehat.

## 15. Approval

Stakeholder telah konfirmasi semua keputusan via brainstorming session 2026-05-26:

- ✅ Profil admin: campuran power user + kontributor (role-based)
- ✅ Editing depth: content-only + CRUD penuh semua entity
- ✅ Hosting: Hostinger VPS Indonesia
- ✅ Publishing: real-time (ISR + on-demand revalidate)
- ✅ Editor UX: inline editing à la Notion/Framer
- ✅ Arsitektur: Opsi A (custom Next.js + Postgres)
- ✅ Auth: bcrypt (basic, bukan Argon2id)
- ✅ Skip Sentry, UptimeRobot, daily backup, manual export, soft delete
- ✅ Hard delete dengan confirmation modal ketik nama
- ✅ Roadmap 6 fase, 23-30 hari kerja
