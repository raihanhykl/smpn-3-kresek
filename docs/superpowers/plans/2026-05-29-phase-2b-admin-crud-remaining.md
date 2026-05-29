# Phase 2b — Admin CRUD for Remaining Entities Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give non-developer staff full CRUD over the remaining landing-page entities (Ekstrakurikuler, Galeri, Fasilitas, Mata Pelajaran, Struktur Organisasi) using the exact EntityManager pattern shipped in Phase 2a for Teacher/Achievement/FAQ.

**Architecture:** Each entity gets (1) write functions in its repository (create/update/delete/reorder following the Phase 2a precedent), (2) a server-action file in `_actions/` using `withRole` + Zod parse + audit + `revalidateTag`, (3) a `<Entity>Manager.tsx` client component (EntityTable + EntityDrawer + DeleteConfirmDialog + react-hook-form), (4) a server `page.tsx` that reads the list and renders the manager, and (5) an `adminNav` entry. Public pages already read full lists (Phase 2a fix), so admin edits show immediately.

**Tech Stack:** Next.js 15 App Router, React 19 (useTransition), react-hook-form + zodResolver, @dnd-kit, Prisma 6 + local Postgres (port 5432), NextAuth v5.

**Non-negotiables (from Phase 2a):**
- Public pages read full entity lists — NEVER a curated `featuredIds` subset (see memory: admin-crud-must-show-on-public).
- Per-category-ordered entities (Ekstrakurikuler) reorder per-category like `reorderTeachers`, NOT a flat global index.
- Server actions return `ActionResult<T>`; errors mapped via `mapActionError`; never leak Prisma errors.
- Zod `formSchema` in the manager mirrors the entity schema with `.omit({ id: true })` semantics.

---

## Chunk 1: Shared constants + Ekstrakurikuler

### Task 1: Extract CATEGORY_ORDER constants to @config

**Why:** `TEACHER_CATEGORY_ORDER` lives inline in teacher-repo.ts; Ekstrakurikuler needs an equivalent `EKSKUL_CATEGORY_ORDER`. The seed script also defines these. Reviewer (Phase 2a) recommended a single source of truth before replicating.

**Files:**
- Create: `src/config/category-order.ts`
- Modify: `src/lib/data/repositories/teacher-repo.ts` (import instead of inline)
- Modify: `scripts/seed-content.ts` (import instead of inline, if it defines its own)

**Steps:**
- [ ] Create `src/config/category-order.ts` exporting `TEACHER_CATEGORY_ORDER: Record<Teacher['category'], number>` (`pimpinan:0, guru:1, tu:2`) and `EKSKUL_CATEGORY_ORDER: Record<Extracurricular['category'], number>` (`wajib:0, olahraga:1, seni:2, akademik:3, keagamaan:4, lainnya:5`).
- [ ] Replace the inline const in teacher-repo.ts with an import; verify `npm run test:int -- teacher` still passes.
- [ ] If seed-content.ts defines its own order maps, import from @config instead. Re-run seed against dev DB to confirm no drift.
- [ ] `npx tsc --noEmit` clean. Commit.

### Task 2: Ekstrakurikuler CRUD

**Entity shape** (`Extracurricular`): `name, category (wajib|olahraga|seni|akademik|keagamaan|lainnya), description, pembina, schedule, achievement? (optional), icon`. Per-category order (categoryOrder + order).

**Files:**
- Modify: `src/lib/data/repositories/extracurricular-repo.ts` — add `ExtracurricularInput`, `createExtracurricular`, `updateExtracurricular`, `deleteExtracurricular`, `reorderExtracurriculars` (PER-CATEGORY like reorderTeachers, using `EKSKUL_CATEGORY_ORDER`).
- Create: `src/app/(admin)/admin/entities/_actions/extracurricular-actions.ts` — revalidate tags `extracurriculars` + `page:fasilitas`.
- Create: `src/app/(admin)/admin/entities/ekskul/ExtracurricularManager.tsx`
- Create: `src/app/(admin)/admin/entities/ekskul/page.tsx`
- Modify: `src/config/admin-nav.ts` — add nav item (icon `🎯`, roles ADMIN+EDITOR).

**Form fields:** name (text), category (select 6 opts), description (textarea), pembina (text), schedule (text), achievement (text, optional — empty string → omit), icon (text, emoji hint). Table columns: Nama, Kategori, Pembina.

**Steps:**
- [ ] Add repo write functions. Integration test: create → appears in `getExtracurriculars`; reorder within a category renumbers per-category.
- [ ] Add actions file. Action test (mock getSession + next/cache) for create/update/delete authz.
- [ ] Build Manager + page mirroring TeacherManager (category select, per-category implications handled in repo).
- [ ] Add nav entry.
- [ ] `npx tsc --noEmit` + `npm run test:int` + `npm test` clean. Commit.

---

## Chunk 2: Galeri + Fasilitas

### Task 3: Galeri (GalleryItem) CRUD

**Entity shape** (`GalleryItem`): `caption, emoji, gradientFrom, gradientTo, category? (optional string), span? (wide|tall|normal, optional)`. Flat global order.

**Files:**
- Modify: `src/lib/data/repositories/gallery-repo.ts` — add `GalleryItemInput`, create/update/delete/reorder (flat order like reorderFaqs).
- Create: `_actions/gallery-actions.ts` — revalidate `gallery` + `page:home` + `page:fasilitas`.
- Create: `entities/gallery/GalleryItemManager.tsx` + `page.tsx`. Reuse `GradientPhotoPicker` for gradientFrom/gradientTo + emoji.
- Modify: `admin-nav.ts` (icon `🖼️`).

**Form fields:** caption (text), gradient+emoji (GradientPhotoPicker → gradientFrom/gradientTo/emoji), category (text optional), span (select: normal/wide/tall — default normal; "normal" stored or omitted per schema). Table columns: Caption, Kategori.

**Steps:** same 5-step rhythm as Task 2. Note optional fields: empty category → omit; span default 'normal'.

### Task 4: Fasilitas (Facility) CRUD — discriminated union

**Entity shape:** discriminated by `kind`. `kind=featured`: `name, description, emoji, gradientFrom, gradientTo, span?`. `kind=mini`: `name, icon`. Order is per-kind (orderBy `[kind, order]`).

**Files:**
- Modify: `src/lib/data/repositories/facility-repo.ts` — add `FacilityInput` (the discriminated union from `facilitySchema` minus id), create/update/delete/reorder. Reorder PER-KIND (featured vs mini separately), mirroring reorderTeachers' per-group logic but keyed on `kind`. `kindToColumns` helper maps the union to nullable columns (like teacher `photoToColumns`).
- Create: `_actions/facility-actions.ts` — revalidate `facilities` + `page:fasilitas`.
- Create: `entities/facilities/FacilityManager.tsx` + `page.tsx`. Form shows a `kind` select; fields conditionally render (watch `kind`). Two tables OR one table with a Tipe column + filter — single table with "Tipe" column is simpler; reorder still per-kind in repo.
- Modify: `admin-nav.ts` (icon `🏫`).

**Form fields:** kind (select featured|mini). If featured: name, description (textarea), emoji, gradientFrom+gradientTo (GradientPhotoPicker without emoji, or color inputs), span (select). If mini: name, icon. Use react-hook-form `watch('kind')` to toggle. Table columns: Nama, Tipe.

**Steps:** 5-step rhythm. Extra care: the form's Zod schema must be a discriminated union so RHF validates the correct branch; default to `featured` on create.

---

## Chunk 3: Mata Pelajaran + Struktur Organisasi

### Task 5: Mata Pelajaran (Subject) CRUD

**Entity shape** (`Subject` row): `grade (7|8|9), groupId, groupTitle, name, icon, iconBg, hours`. Read groups subjects into `SubjectGroup[]` per grade. Order within `[grade, order]`.

**Files:**
- Modify: `src/lib/data/repositories/subject-repo.ts` — add `getAllSubjects` (flat list for admin table), `SubjectInput`, create/update/delete/reorder (flat order; reorder scoped per grade or global — keep global `order`, since intra-grade ordering uses `[grade, order]` the global index is fine as long as it's monotonic; SAFER: reorder per grade like per-category). Keep existing `getSubjectGroupsByGrade` for the public page.
- Create: `_actions/subject-actions.ts` — revalidate `subjects` + `page:akademik`.
- Create: `entities/subjects/SubjectManager.tsx` + `page.tsx`. Admin table is a FLAT list of subject rows (not grouped) with Grade + Group columns; this keeps CRUD simple. The public page re-groups.
- Modify: `admin-nav.ts` (icon `📚`).

**Form fields:** grade (select 7/8/9), groupId (text), groupTitle (text), name (text), icon (text emoji), iconBg (text — tailwind class or color), hours (text). Table columns: Nama, Kelas, Kelompok.

**Steps:** 5-step rhythm. Note: reorder per-grade to avoid cross-grade index clash. `getAllSubjects` reads all rows ordered `[grade, order]`.

### Task 6: Struktur Organisasi (OrganizationMember) CRUD

**Entity shape** (`OrganizationMember`): `name, role, level (0..10 int), parentId (nullable)`. Read groups by level into `OrgChartLevel[]`. Order within `[level, order]`.

**Files:**
- Modify: `src/lib/data/repositories/organization-repo.ts` — add `getAllOrganizationMembers` (flat list for admin), `OrganizationMemberInput`, create/update/delete/reorder (per-level order). `deleteOrganizationMember` relies on FK `onDelete: SetNull` for children's parentId.
- Create: `_actions/organization-actions.ts` — revalidate `organization` + `page:profil`.
- Create: `entities/organization/OrganizationMemberManager.tsx` + `page.tsx`. Form: name, role, level (number select 0..N), parentId (select of existing members + "none"). Table columns: Nama, Jabatan, Level.
- Modify: `admin-nav.ts` (icon `🗂️`).

**Form fields:** name (text), role (text), level (number input 0..10), parentId (select; options = other members; allow empty → null). Table columns: Nama, Jabatan, Level.

**Steps:** 5-step rhythm. parentId select must exclude self when editing; empty selection → `null`.

---

## Chunk 4: Verification

### Task 7: End-to-end verification + regression guard

**Steps:**
- [ ] `npx tsc --noEmit` clean across whole repo.
- [ ] `npm test` (unit) + `npm run test:int` (integration) all green.
- [ ] Browser smoke (dev server on local DB): for EACH of the 5 entities — add a row via admin, confirm it appears on the corresponding public page (/fasilitas, /home, /akademik, /profil) after save; edit a row, confirm change shows; reorder, confirm order persists after refresh.
- [ ] Confirm no console errors beyond the known benign dnd-kit aria-describedby hydration warning.
- [ ] Run the visual baseline suite; if intentional content changes occurred, note them (do not blindly update snapshots).
- [ ] Final commit.

---

## Deferred (NOT in 2b)
- SiteConfig + Navigation singleton editors → these are config-shaped (not list CRUD); will follow as a small Phase 2c after the list entities are verified, to keep 2b focused on the repeatable list pattern.
- DocumentSlot (PDF) → Phase 3 (Cloudinary media).
- Inline editor → Phase 4. Polish → Phase 5.
