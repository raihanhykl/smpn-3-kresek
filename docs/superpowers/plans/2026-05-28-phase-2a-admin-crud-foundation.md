# Phase 2a: Admin CRUD Foundation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [2026-05-26-admin-dashboard-design.md](../specs/2026-05-26-admin-dashboard-design.md) (Section 6 Entity CRUD panel + Section 8 cache invalidation)

**Goal:** Bangun fondasi admin dashboard CRUD: admin shell (sidebar + topbar), generic CRUD scaffolding (list table + side-drawer form), server-action mutation pattern dengan cache invalidation (`revalidateTag`), audit logging, dan **buktikan dengan 3 entity end-to-end**: Teacher, Achievement, Faq. Phase 2b akan replikasi pattern ke entity sisanya (Extracurricular, Subject, GalleryItem, Facility, OrganizationMember) + singleton editors (SiteConfig, Navigation, DocumentSlot).

**Architecture:**
- **Write repositories**: setiap entity dapat `create`/`update`/`delete`/`reorder` functions di repository (extend file repo yang sudah ada dari Phase 1, yang sekarang read-only).
- **Server actions**: per-entity `actions.ts` dengan `'use server'`. Setiap action: `requireRole` guard → Zod validate → Prisma mutation → `writeAudit` → `revalidateTag`. Return typed result `{ ok: true } | { ok: false, error }`.
- **Cache invalidation**: tiap mutation panggil `revalidateTag` dengan tag entity + tag halaman publik yang terdampak (e.g., update Teacher → `revalidateTag('teachers')` + `revalidateTag('page:profil')`).
- **Admin shell**: `(admin)/admin/layout.tsx` jadi proper shell (sidebar nav + topbar user menu). Re-verify session + role (defense layer 2).
- **Generic CRUD UI**: reusable `<EntityTable>` (list, search, drag-reorder) + `<EntityDrawer>` (slide-in form) + `<DeleteConfirmDialog>` (type-name-to-confirm). Each entity provides a column config + form fields config.
- **Form**: `react-hook-form` + `@hookform/resolvers/zod` + the Phase 1 entity Zod schemas. Explicit Save button (not autosave). Side drawer slide-in.
- **Foto**: gradient + emoji picker only (Cloudinary upload is Phase 3). A `<GradientPhotoPicker>` component edits the `Photo` discriminated union `kind: 'gradient'`.

**Tech Stack:** Next.js 15 Server Actions • Prisma 6 • react-hook-form • @hookform/resolvers • zod • dnd-kit • Tailwind • Jest + Playwright

**Deliverable:** Admin login → sidebar dashboard → kelola Guru/Prestasi/FAQ (list, search, tambah, edit, hapus, drag-reorder). Perubahan langsung muncul di public site (cache invalidated). Audit log per mutation. Tests + E2E.

**Bukan scope Phase 2a:**
- Entity sisanya (Extracurricular, Subject, Gallery, Facility, Organization) → **Phase 2b**
- Singleton editors (SiteConfig, Navigation), DocumentSlot → **Phase 2b**
- User management UI → **Phase 2b** (atau Phase 5)
- Cloudinary / foto upload → **Phase 3**
- Inline editor → **Phase 4**

---

## Chunk 1: Dependencies + admin shell + auth helpers

### Task 1: Install deps + write-action helpers

**Files:**
- Modify: `package.json`
- Create: `src/lib/auth/server-action-guard.ts`
- Create: `src/__tests__/lib/auth/server-action-guard.test.ts`

- [ ] **Step 1.1: Install dependencies**

Run:
```bash
npm install react-hook-form@^7.54.0 @hookform/resolvers@^3.9.0 @dnd-kit/core@^6.3.0 @dnd-kit/sortable@^9.0.0 @dnd-kit/utilities@^3.2.2
```

Expected: installs without error.

- [ ] **Step 1.2: Verify deps**

Run: `npm ls react-hook-form @hookform/resolvers @dnd-kit/core @dnd-kit/sortable`
Expected: tree printed, no UNMET.

- [ ] **Step 1.3: Write failing test for server-action guard**

The guard wraps a server-action body with session+role check and converts thrown auth errors into a typed failure result (so the action never leaks a 500 to the client for an auth failure).

Create `src/__tests__/lib/auth/server-action-guard.test.ts`:
```ts
import { withRole, type ActionResult } from '@/lib/auth/server-action-guard';
import { UnauthorizedError, ForbiddenError } from '@/lib/auth/require-role';

describe('withRole', () => {
  const adminSession = { user: { id: 'u1', role: 'ADMIN' as const } };
  const editorSession = { user: { id: 'u2', role: 'EDITOR' as const } };

  it('runs the body and returns ok when role allowed', async () => {
    const result = await withRole(adminSession, ['ADMIN'], async (user) => {
      expect(user.id).toBe('u1');
      return { created: true };
    });
    expect(result).toEqual({ ok: true, data: { created: true } });
  });

  it('returns unauthorized failure when session null', async () => {
    const result = await withRole(null, ['ADMIN'], async () => ({ x: 1 }));
    expect(result).toEqual({ ok: false, error: 'unauthorized' });
  });

  it('returns forbidden failure when role not allowed', async () => {
    const result = await withRole(editorSession, ['ADMIN'], async () => ({ x: 1 }));
    expect(result).toEqual({ ok: false, error: 'forbidden' });
  });

  it('lets EDITOR through when allowed', async () => {
    const result = await withRole(editorSession, ['ADMIN', 'EDITOR'], async () => ({ x: 1 }));
    expect(result).toEqual({ ok: true, data: { x: 1 } });
  });

  it('surfaces a validation failure thrown inside body as a typed error', async () => {
    const result = await withRole(adminSession, ['ADMIN'], async () => {
      throw new Error('Nama wajib diisi');
    });
    expect(result).toEqual({ ok: false, error: 'Nama wajib diisi' });
  });

  it('passes through UnauthorizedError/ForbiddenError thrown deeper as their codes', async () => {
    const r1 = await withRole(adminSession, ['ADMIN'], async () => { throw new UnauthorizedError(); });
    expect(r1).toEqual({ ok: false, error: 'unauthorized' });
    const r2 = await withRole(adminSession, ['ADMIN'], async () => { throw new ForbiddenError(); });
    expect(r2).toEqual({ ok: false, error: 'forbidden' });
  });
});
```

- [ ] **Step 1.4: Run test, expect FAIL**

Run: `npm test -- --testPathPattern='server-action-guard'`
Expected: FAIL — module not found.

- [ ] **Step 1.5: Implement guard**

Create `src/lib/auth/server-action-guard.ts`:
```ts
import {
  requireRole, UnauthorizedError, ForbiddenError,
  type AuthSession, type Role, type AuthSessionUser,
} from '@/lib/auth/require-role';

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Wraps a server-action body with a session+role check. Converts auth errors
 * AND any error thrown inside the body into a typed ActionResult so the client
 * form gets a clean error string instead of a 500. The body receives the
 * authenticated user.
 */
export async function withRole<T>(
  session: AuthSession,
  allowed: Role[],
  body: (user: AuthSessionUser) => Promise<T>,
): Promise<ActionResult<T>> {
  let user: AuthSessionUser;
  try {
    user = requireRole(session, allowed);
  } catch (err) {
    if (err instanceof UnauthorizedError) return { ok: false, error: 'unauthorized' };
    if (err instanceof ForbiddenError) return { ok: false, error: 'forbidden' };
    return { ok: false, error: 'forbidden' };
  }
  try {
    const data = await body(user);
    return { ok: true, data };
  } catch (err) {
    if (err instanceof UnauthorizedError) return { ok: false, error: 'unauthorized' };
    if (err instanceof ForbiddenError) return { ok: false, error: 'forbidden' };
    return { ok: false, error: err instanceof Error ? err.message : 'unknown_error' };
  }
}
```

- [ ] **Step 1.6: Run test, expect PASS**

Run: `npm test -- --testPathPattern='server-action-guard'`
Expected: 6 tests pass.

- [ ] **Step 1.7: Commit**

```bash
git add package.json package-lock.json \
        src/lib/auth/server-action-guard.ts \
        src/__tests__/lib/auth/server-action-guard.test.ts
git commit -m "feat(admin): server-action role guard + crud deps (rhf, dnd-kit)"
```

---

### Task 2: Admin shell layout (sidebar + topbar)

**Why:** Replace the minimal `(admin)/layout.tsx` passthrough with a proper shell: sidebar nav (Dashboard, Guru, Prestasi, FAQ, ...) + topbar (school name, user name, logout). Re-verify session/role in the layout (defense-in-depth layer 2). Login + change-password pages must NOT get the shell (they have their own full-screen layout).

**Files:**
- Create: `src/components/admin/AdminShell.tsx`
- Create: `src/components/admin/AdminSidebar.tsx`
- Create: `src/config/admin-nav.ts`
- Modify: `src/app/(admin)/admin/dashboard/page.tsx` (use shell)
- Note: login + change-password keep their own layout (don't wrap)

- [ ] **Step 2.1: Admin nav config**

Create `src/config/admin-nav.ts`:
```ts
export type AdminNavItem = {
  label: string;
  href: string;
  icon: string; // emoji for now (Phase 5 may swap to icon set)
  /** Which roles see this item. */
  roles: ('ADMIN' | 'EDITOR')[];
};

export type AdminNavGroup = {
  heading: string;
  items: AdminNavItem[];
};

export const adminNav: AdminNavGroup[] = [
  {
    heading: 'Umum',
    items: [
      { label: 'Dashboard', href: '/admin/dashboard', icon: '🏠', roles: ['ADMIN', 'EDITOR'] },
    ],
  },
  {
    heading: 'Konten',
    items: [
      { label: 'Guru & Staf', href: '/admin/entities/teachers', icon: '👩‍🏫', roles: ['ADMIN', 'EDITOR'] },
      { label: 'Prestasi', href: '/admin/entities/achievements', icon: '🏆', roles: ['ADMIN', 'EDITOR'] },
      { label: 'FAQ', href: '/admin/entities/faqs', icon: '❓', roles: ['ADMIN', 'EDITOR'] },
      // Phase 2b adds: Ekstrakurikuler, Mata Pelajaran, Galeri, Fasilitas, Struktur Organisasi
    ],
  },
];
```

- [ ] **Step 2.2: Sidebar component (client — needs active-link highlight)**

Create `src/components/admin/AdminSidebar.tsx`:
```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { adminNav } from '@config/admin-nav';
import type { Role } from '@/lib/auth/require-role';

export function AdminSidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  return (
    <nav className="flex h-full w-60 shrink-0 flex-col gap-6 border-r border-neutral-200 bg-white px-4 py-6">
      <div className="px-2">
        <span className="font-heading text-lg font-extrabold text-primary">SMPN 3 Kresek</span>
        <p className="text-xs text-neutral-500">Panel Admin</p>
      </div>
      {adminNav.map((group) => {
        const visible = group.items.filter((i) => i.roles.includes(role));
        if (visible.length === 0) return null;
        return (
          <div key={group.heading}>
            <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
              {group.heading}
            </p>
            <ul className="space-y-1">
              {visible.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                        active
                          ? 'bg-primary/10 text-primary'
                          : 'text-neutral-700 hover:bg-neutral-100'
                      }`}
                    >
                      <span aria-hidden>{item.icon}</span>
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2.3: Admin shell (server component wrapper)**

Create `src/components/admin/AdminShell.tsx`:
```tsx
import type { ReactNode } from 'react';
import { AdminSidebar } from './AdminSidebar';
import { logoutAction } from '@/app/(admin)/admin/dashboard/actions';
import type { Role } from '@/lib/auth/require-role';

export function AdminShell({
  children,
  userName,
  role,
}: {
  children: ReactNode;
  userName: string;
  role: Role;
}) {
  return (
    <div className="flex min-h-screen bg-neutral-50">
      <AdminSidebar role={role} />
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-6">
          <span className="text-sm text-neutral-500">Panel Pengelolaan Konten</span>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-neutral-700">{userName}</span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
              >
                Keluar
              </button>
            </form>
          </div>
        </header>
        <main className="flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2.4: Use shell in dashboard page**

Replace `src/app/(admin)/admin/dashboard/page.tsx`:
```tsx
import { auth } from '@/lib/auth/config';
import { AdminShell } from '@/components/admin/AdminShell';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await auth();
  const name = session?.user.name ?? 'Admin';
  const role = session?.user.role ?? 'EDITOR';
  return (
    <AdminShell userName={name} role={role}>
      <h1 className="font-heading text-2xl font-extrabold text-neutral-900">Dashboard</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Selamat datang. Pilih menu di samping untuk mengelola konten website.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <DashCard href="/admin/entities/teachers" icon="👩‍🏫" title="Guru & Staf" desc="Kelola data guru dan staf" />
        <DashCard href="/admin/entities/achievements" icon="🏆" title="Prestasi" desc="Kelola daftar prestasi sekolah" />
        <DashCard href="/admin/entities/faqs" icon="❓" title="FAQ" desc="Kelola pertanyaan umum" />
      </div>
    </AdminShell>
  );
}

function DashCard({ href, icon, title, desc }: { href: string; icon: string; title: string; desc: string }) {
  return (
    <a
      href={href}
      className="rounded-xl border border-neutral-200 bg-white p-5 transition hover:border-primary hover:shadow-sm"
    >
      <span className="text-2xl" aria-hidden>{icon}</span>
      <h2 className="mt-2 font-semibold text-neutral-900">{title}</h2>
      <p className="mt-1 text-sm text-neutral-500">{desc}</p>
    </a>
  );
}
```

- [ ] **Step 2.5: Typecheck + lint + build**

Run: `npm run typecheck && npm run lint && SKIP_ENV_VALIDATION=true npm run build`
Expected: clean. `/admin/dashboard` still renders (now with shell).

- [ ] **Step 2.6: Commit**

```bash
git add src/components/admin/ src/config/admin-nav.ts 'src/app/(admin)/admin/dashboard/page.tsx'
git commit -m "feat(admin): admin shell (sidebar + topbar) + dashboard cards"
```

---

## Chunk 2: Write repository layer + Teacher CRUD actions

### Task 3: Write functions for Teacher/Achievement/Faq repos

**Why:** Phase 1 repos are read-only (`getTeachers`, etc). Add `create`/`update`/`delete`/`reorder` to each. Keep read functions; add write functions in the same file (cohesion — they touch the same table). Each write function does the Prisma mutation only; cache invalidation + audit happen in the server action (so the repo stays pure data-access, no Next.js cache coupling).

**Files:**
- Modify: `src/lib/data/repositories/teacher-repo.ts`
- Modify: `src/lib/data/repositories/achievement-repo.ts`
- Modify: `src/lib/data/repositories/faq-repo.ts`
- Create: `src/__tests__/integration/repositories/teacher-write.test.ts`

- [ ] **Step 3.1: Write failing integration test for teacher write ops**

Create `src/__tests__/integration/repositories/teacher-write.test.ts`:
```ts
import { prisma } from '@/lib/db/client';
import {
  createTeacher, updateTeacher, deleteTeacher, reorderTeachers,
} from '@/lib/data/repositories/teacher-repo';
import type { Teacher } from '@config/types';

const gradientPhoto: Teacher['photo'] = { kind: 'gradient', from: '#000', to: '#fff', emoji: '👤' };

describe('teacher write repository', () => {
  beforeEach(async () => {
    await prisma.teacher.deleteMany({});
  });
  afterAll(async () => {
    await prisma.teacher.deleteMany({});
    await prisma.$disconnect();
  });

  it('createTeacher inserts a row and returns the created Teacher with generated id', async () => {
    const created = await createTeacher({
      name: 'Bu Siti', position: 'Guru Matematika', badge: 'S.Pd.',
      category: 'guru', photo: gradientPhoto,
    });
    expect(created.id).toBeTruthy();
    expect(created.name).toBe('Bu Siti');
    const inDb = await prisma.teacher.findUnique({ where: { id: created.id } });
    expect(inDb?.categoryOrder).toBe(1); // guru = categoryOrder 1
    expect(inDb?.photoKind).toBe('gradient');
  });

  it('createTeacher assigns next order within category', async () => {
    const a = await createTeacher({ name: 'A', position: 'p', badge: 'b', category: 'guru', photo: gradientPhoto });
    const b = await createTeacher({ name: 'B', position: 'p', badge: 'b', category: 'guru', photo: gradientPhoto });
    const aDb = await prisma.teacher.findUnique({ where: { id: a.id } });
    const bDb = await prisma.teacher.findUnique({ where: { id: b.id } });
    expect(aDb?.order).toBe(0);
    expect(bDb?.order).toBe(1);
  });

  it('updateTeacher changes fields', async () => {
    const created = await createTeacher({ name: 'A', position: 'p', badge: 'b', category: 'guru', photo: gradientPhoto });
    const updated = await updateTeacher(created.id, {
      name: 'A Updated', position: 'Wakasek', badge: 'M.Pd.',
      category: 'pimpinan', photo: gradientPhoto,
    });
    expect(updated.name).toBe('A Updated');
    const inDb = await prisma.teacher.findUnique({ where: { id: created.id } });
    expect(inDb?.category).toBe('pimpinan');
    expect(inDb?.categoryOrder).toBe(0); // pimpinan = 0
  });

  it('updateTeacher throws when id missing', async () => {
    await expect(
      updateTeacher('nonexistent', { name: 'x', position: 'p', badge: 'b', category: 'guru', photo: gradientPhoto }),
    ).rejects.toThrow();
  });

  it('deleteTeacher removes the row', async () => {
    const created = await createTeacher({ name: 'A', position: 'p', badge: 'b', category: 'guru', photo: gradientPhoto });
    await deleteTeacher(created.id);
    const inDb = await prisma.teacher.findUnique({ where: { id: created.id } });
    expect(inDb).toBeNull();
  });

  it('reorderTeachers sets order by array index within category', async () => {
    const a = await createTeacher({ name: 'A', position: 'p', badge: 'b', category: 'guru', photo: gradientPhoto });
    const b = await createTeacher({ name: 'B', position: 'p', badge: 'b', category: 'guru', photo: gradientPhoto });
    const c = await createTeacher({ name: 'C', position: 'p', badge: 'b', category: 'guru', photo: gradientPhoto });
    // New order: c, a, b
    await reorderTeachers([c.id, a.id, b.id]);
    const rows = await prisma.teacher.findMany({ orderBy: { order: 'asc' } });
    expect(rows.map((r) => r.id)).toEqual([c.id, a.id, b.id]);
    expect(rows.map((r) => r.order)).toEqual([0, 1, 2]);
  });
});
```

- [ ] **Step 3.2: Run, expect FAIL**

Run: `npm run test:int -- --testPathPattern='teacher-write'`
Expected: FAIL — functions not exported.

- [ ] **Step 3.3: Add write functions to teacher-repo.ts**

Append to `src/lib/data/repositories/teacher-repo.ts` (keep existing read code + `rowToTeacher`):
```ts
import type { Prisma } from '@prisma/client';

// Category → explicit display order. Mirror of seed-content's TEACHER_CATEGORY_ORDER.
const TEACHER_CATEGORY_ORDER: Record<Teacher['category'], number> = {
  pimpinan: 0, guru: 1, tu: 2,
};

export type TeacherInput = Omit<Teacher, 'id'>;

function photoToColumns(photo: Teacher['photo']): Prisma.TeacherUncheckedCreateInput['photoKind'] extends string
  ? Pick<Prisma.TeacherUncheckedCreateInput, 'photoKind' | 'photoSrc' | 'photoAlt' | 'photoFrom' | 'photoTo' | 'photoEmoji'>
  : never {
  if (photo.kind === 'url') {
    return { photoKind: 'url', photoSrc: photo.src, photoAlt: photo.alt, photoFrom: null, photoTo: null, photoEmoji: null };
  }
  return { photoKind: 'gradient', photoSrc: null, photoAlt: null, photoFrom: photo.from, photoTo: photo.to, photoEmoji: photo.emoji };
}

export async function createTeacher(input: TeacherInput): Promise<Teacher> {
  const categoryOrder = TEACHER_CATEGORY_ORDER[input.category];
  // Next order within the same category.
  const max = await prisma.teacher.aggregate({
    where: { category: input.category },
    _max: { order: true },
  });
  const order = (max._max.order ?? -1) + 1;
  const row = await prisma.teacher.create({
    data: {
      name: input.name, position: input.position, badge: input.badge,
      category: input.category, categoryOrder, order, ...photoToColumns(input.photo),
    },
  });
  return rowToTeacher(row);
}

export async function updateTeacher(id: string, input: TeacherInput): Promise<Teacher> {
  const categoryOrder = TEACHER_CATEGORY_ORDER[input.category];
  const row = await prisma.teacher.update({
    where: { id },
    data: {
      name: input.name, position: input.position, badge: input.badge,
      category: input.category, categoryOrder, ...photoToColumns(input.photo),
    },
  });
  return rowToTeacher(row);
}

export async function deleteTeacher(id: string): Promise<void> {
  await prisma.teacher.delete({ where: { id } });
}

/**
 * Reorder teachers by setting `order` = index in the provided id list.
 * The list should contain ids that belong together (e.g. all of one category,
 * or the full set — caller decides). Runs in a transaction.
 */
export async function reorderTeachers(orderedIds: string[]): Promise<void> {
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.teacher.update({ where: { id }, data: { order: index } }),
    ),
  );
}
```

**Note**: the `photoToColumns` return-type expression is awkward — if TS complains, simplify to an explicit return type:
```ts
function photoToColumns(photo: Teacher['photo']): {
  photoKind: string; photoSrc: string | null; photoAlt: string | null;
  photoFrom: string | null; photoTo: string | null; photoEmoji: string | null;
} { ... }
```

- [ ] **Step 3.4: Run, expect PASS**

Run: `npm run test:int -- --testPathPattern='teacher-write'`
Expected: 6 tests pass.

- [ ] **Step 3.5: Add write functions to achievement-repo.ts**

Append to `src/lib/data/repositories/achievement-repo.ts`:
```ts
export type AchievementInput = Omit<Achievement, 'id'>;

export async function createAchievement(input: AchievementInput): Promise<Achievement> {
  const max = await prisma.achievement.aggregate({ _max: { order: true } });
  const order = (max._max.order ?? -1) + 1;
  const row = await prisma.achievement.create({
    data: {
      year: input.year, title: input.title, recipient: input.recipient,
      organizer: input.organizer, level: input.level, icon: input.icon, order,
    },
  });
  return rowToAchievement(row);
}

export async function updateAchievement(id: string, input: AchievementInput): Promise<Achievement> {
  const row = await prisma.achievement.update({
    where: { id },
    data: {
      year: input.year, title: input.title, recipient: input.recipient,
      organizer: input.organizer, level: input.level, icon: input.icon,
    },
  });
  return rowToAchievement(row);
}

export async function deleteAchievement(id: string): Promise<void> {
  await prisma.achievement.delete({ where: { id } });
}

export async function reorderAchievements(orderedIds: string[]): Promise<void> {
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.achievement.update({ where: { id }, data: { order: index } }),
    ),
  );
}
```

- [ ] **Step 3.6: Add write functions to faq-repo.ts**

The faq-repo's `loadFaqs` maps rows but there's no exported `rowToFaq`. Add a small inline mapping. Append:
```ts
export type FaqInput = Omit<Faq, 'id'>;

export async function createFaq(input: FaqInput): Promise<Faq> {
  const max = await prisma.faq.aggregate({ _max: { order: true } });
  const order = (max._max.order ?? -1) + 1;
  const row = await prisma.faq.create({
    data: { question: input.question, answer: input.answer, category: input.category, order },
  });
  return { id: row.id, question: row.question, answer: row.answer, category: row.category as Faq['category'] };
}

export async function updateFaq(id: string, input: FaqInput): Promise<Faq> {
  const row = await prisma.faq.update({
    where: { id },
    data: { question: input.question, answer: input.answer, category: input.category },
  });
  return { id: row.id, question: row.question, answer: row.answer, category: row.category as Faq['category'] };
}

export async function deleteFaq(id: string): Promise<void> {
  await prisma.faq.delete({ where: { id } });
}

export async function reorderFaqs(orderedIds: string[]): Promise<void> {
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.faq.update({ where: { id }, data: { order: index } }),
    ),
  );
}
```

- [ ] **Step 3.7: Add a quick integration test for achievement + faq writes**

Create `src/__tests__/integration/repositories/achievement-faq-write.test.ts`:
```ts
import { prisma } from '@/lib/db/client';
import { createAchievement, updateAchievement, deleteAchievement, reorderAchievements } from '@/lib/data/repositories/achievement-repo';
import { createFaq, updateFaq, deleteFaq } from '@/lib/data/repositories/faq-repo';

describe('achievement + faq write repositories', () => {
  beforeEach(async () => {
    await prisma.achievement.deleteMany({});
    await prisma.faq.deleteMany({});
  });
  afterAll(async () => {
    await prisma.achievement.deleteMany({});
    await prisma.faq.deleteMany({});
    await prisma.$disconnect();
  });

  it('createAchievement + update + delete roundtrip', async () => {
    const a = await createAchievement({
      year: 2024, title: 'Juara 1', recipient: 'Tim', organizer: 'Kemendikbud', level: 'nasional', icon: '🏆',
    });
    expect(a.id).toBeTruthy();
    const u = await updateAchievement(a.id, { ...a, title: 'Juara 2' });
    expect(u.title).toBe('Juara 2');
    await deleteAchievement(a.id);
    expect(await prisma.achievement.findUnique({ where: { id: a.id } })).toBeNull();
  });

  it('reorderAchievements sets order by index', async () => {
    const a = await createAchievement({ year: 2024, title: 'A', recipient: 'r', organizer: 'o', level: 'nasional', icon: '🏆' });
    const b = await createAchievement({ year: 2024, title: 'B', recipient: 'r', organizer: 'o', level: 'nasional', icon: '🏆' });
    await reorderAchievements([b.id, a.id]);
    const rows = await prisma.achievement.findMany({ orderBy: { order: 'asc' } });
    expect(rows.map((r) => r.id)).toEqual([b.id, a.id]);
  });

  it('createFaq + update + delete roundtrip', async () => {
    const f = await createFaq({ question: 'Q?', answer: 'A.', category: 'ppdb' });
    expect(f.id).toBeTruthy();
    const u = await updateFaq(f.id, { ...f, answer: 'Updated.' });
    expect(u.answer).toBe('Updated.');
    await deleteFaq(f.id);
    expect(await prisma.faq.findUnique({ where: { id: f.id } })).toBeNull();
  });
});
```

- [ ] **Step 3.8: Run, expect PASS**

Run: `npm run test:int -- --testPathPattern='achievement-faq-write'`
Expected: 3 tests pass.

- [ ] **Step 3.9: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 3.10: Commit**

```bash
git add src/lib/data/repositories/teacher-repo.ts \
        src/lib/data/repositories/achievement-repo.ts \
        src/lib/data/repositories/faq-repo.ts \
        src/__tests__/integration/repositories/teacher-write.test.ts \
        src/__tests__/integration/repositories/achievement-faq-write.test.ts
git commit -m "feat(data): write ops (create/update/delete/reorder) for Teacher, Achievement, Faq"
```

---

### Task 4: Server actions for Teacher/Achievement/Faq (with cache invalidation + audit)

**Why:** Server actions are the mutation entry point from the admin UI. Each action: get session → `withRole` guard → Zod validate input → repo write → `writeAudit` → `revalidateTag`. Returns `ActionResult`.

**Files:**
- Create: `src/app/(admin)/admin/entities/_actions/teacher-actions.ts`
- Create: `src/app/(admin)/admin/entities/_actions/achievement-actions.ts`
- Create: `src/app/(admin)/admin/entities/_actions/faq-actions.ts`
- Create: `src/__tests__/integration/admin/teacher-actions.test.ts`

- [ ] **Step 4.1: Write failing integration test for teacher actions**

Create `src/__tests__/integration/admin/teacher-actions.test.ts`:
```ts
import { prisma } from '@/lib/db/client';

// Mock auth + revalidateTag so we can call the actions directly.
const mockSession = { user: { id: 'admin-actions-test', role: 'ADMIN' as const } };
jest.mock('@/lib/auth/session', () => ({
  getSession: jest.fn(async () => mockSession),
}));
const revalidateTagMock = jest.fn();
jest.mock('next/cache', () => ({
  unstable_cache: <T extends (...a: unknown[]) => unknown>(fn: T) => fn,
  revalidateTag: (...args: unknown[]) => revalidateTagMock(...args),
  revalidatePath: jest.fn(),
}));

import {
  createTeacherAction, updateTeacherAction, deleteTeacherAction, reorderTeachersAction,
} from '@/app/(admin)/admin/entities/_actions/teacher-actions';

const validInput = {
  name: 'Bu Ani', position: 'Guru IPA', badge: 'S.Pd.',
  category: 'guru', photo: { kind: 'gradient', from: '#000', to: '#fff', emoji: '🔬' },
};

describe('teacher server actions', () => {
  beforeAll(async () => {
    await prisma.auditLog.deleteMany({ where: { userId: 'admin-actions-test' } });
    await prisma.user.deleteMany({ where: { id: 'admin-actions-test' } });
    await prisma.user.create({
      data: { id: 'admin-actions-test', email: 'aat@test.local', passwordHash: 'x', name: 'AAT', role: 'ADMIN' },
    });
  });
  beforeEach(async () => {
    await prisma.teacher.deleteMany({});
    revalidateTagMock.mockClear();
  });
  afterAll(async () => {
    await prisma.teacher.deleteMany({});
    await prisma.auditLog.deleteMany({ where: { userId: 'admin-actions-test' } });
    await prisma.user.deleteMany({ where: { id: 'admin-actions-test' } });
    await prisma.$disconnect();
  });

  it('createTeacherAction creates + audits + revalidates teachers & page:profil', async () => {
    const result = await createTeacherAction(validInput);
    expect(result.ok).toBe(true);
    const count = await prisma.teacher.count();
    expect(count).toBe(1);
    const audits = await prisma.auditLog.findMany({ where: { userId: 'admin-actions-test', action: 'create_teacher' } });
    expect(audits.length).toBe(1);
    expect(revalidateTagMock).toHaveBeenCalledWith('teachers');
    expect(revalidateTagMock).toHaveBeenCalledWith('page:profil');
  });

  it('createTeacherAction rejects invalid input with typed error', async () => {
    const result = await createTeacherAction({ ...validInput, category: 'invalid-cat' });
    expect(result.ok).toBe(false);
    expect(await prisma.teacher.count()).toBe(0);
  });

  it('updateTeacherAction updates existing', async () => {
    const created = await createTeacherAction(validInput);
    expect(created.ok).toBe(true);
    const id = created.ok ? created.data.id : '';
    const result = await updateTeacherAction(id, { ...validInput, name: 'Bu Ani Updated' });
    expect(result.ok).toBe(true);
    const row = await prisma.teacher.findUnique({ where: { id } });
    expect(row?.name).toBe('Bu Ani Updated');
  });

  it('deleteTeacherAction deletes + audits', async () => {
    const created = await createTeacherAction(validInput);
    const id = created.ok ? created.data.id : '';
    const result = await deleteTeacherAction(id);
    expect(result.ok).toBe(true);
    expect(await prisma.teacher.count()).toBe(0);
    const audits = await prisma.auditLog.findMany({ where: { userId: 'admin-actions-test', action: 'delete_teacher' } });
    expect(audits.length).toBe(1);
  });

  it('reorderTeachersAction reorders', async () => {
    const a = await createTeacherAction(validInput);
    const b = await createTeacherAction({ ...validInput, name: 'B' });
    const aId = a.ok ? a.data.id : '';
    const bId = b.ok ? b.data.id : '';
    const result = await reorderTeachersAction([bId, aId]);
    expect(result.ok).toBe(true);
    const rows = await prisma.teacher.findMany({ orderBy: { order: 'asc' } });
    expect(rows.map((r) => r.id)).toEqual([bId, aId]);
  });
});
```

- [ ] **Step 4.2: Run, expect FAIL**

Run: `npm run test:int -- --testPathPattern='admin/teacher-actions'`
Expected: FAIL — module not found.

- [ ] **Step 4.3: Implement teacher-actions.ts**

Create `src/app/(admin)/admin/entities/_actions/teacher-actions.ts`:
```ts
'use server';

import { revalidateTag } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { withRole, type ActionResult } from '@/lib/auth/server-action-guard';
import { writeAudit } from '@/lib/security/audit';
import { teacherSchema } from '@/lib/validation/schemas/entities/teacher';
import {
  createTeacher, updateTeacher, deleteTeacher, reorderTeachers,
  type TeacherInput,
} from '@/lib/data/repositories/teacher-repo';
import type { Teacher } from '@config/types';

// Form input schema: teacherSchema minus the id (id is generated on create).
const teacherInputSchema = teacherSchema.omit({ id: true });

function revalidateTeachers() {
  revalidateTag('teachers');
  revalidateTag('page:profil'); // /profil lists guru
}

export async function createTeacherAction(raw: unknown): Promise<ActionResult<Teacher>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    const input = teacherInputSchema.parse(raw) as TeacherInput;
    const created = await createTeacher(input);
    await writeAudit({ userId: user.id, action: 'create_teacher', target: `teacher:${created.id}` }).catch(() => {});
    revalidateTeachers();
    return created;
  });
}

export async function updateTeacherAction(id: string, raw: unknown): Promise<ActionResult<Teacher>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    const input = teacherInputSchema.parse(raw) as TeacherInput;
    const updated = await updateTeacher(id, input);
    await writeAudit({ userId: user.id, action: 'update_teacher', target: `teacher:${id}` }).catch(() => {});
    revalidateTeachers();
    return updated;
  });
}

export async function deleteTeacherAction(id: string): Promise<ActionResult<void>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    await deleteTeacher(id);
    await writeAudit({ userId: user.id, action: 'delete_teacher', target: `teacher:${id}` }).catch(() => {});
    revalidateTeachers();
  });
}

export async function reorderTeachersAction(orderedIds: string[]): Promise<ActionResult<void>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    await reorderTeachers(orderedIds);
    await writeAudit({ userId: user.id, action: 'reorder_teacher', target: 'teacher:*' }).catch(() => {});
    revalidateTeachers();
  });
}
```

- [ ] **Step 4.4: Run, expect PASS**

Run: `npm run test:int -- --testPathPattern='admin/teacher-actions'`
Expected: 5 tests pass.

- [ ] **Step 4.5: Implement achievement-actions.ts**

Create `src/app/(admin)/admin/entities/_actions/achievement-actions.ts` (mirror teacher pattern):
```ts
'use server';

import { revalidateTag } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { withRole, type ActionResult } from '@/lib/auth/server-action-guard';
import { writeAudit } from '@/lib/security/audit';
import { achievementSchema } from '@/lib/validation/schemas/entities/achievement';
import {
  createAchievement, updateAchievement, deleteAchievement, reorderAchievements,
  type AchievementInput,
} from '@/lib/data/repositories/achievement-repo';
import type { Achievement } from '@config/types';

const achievementInputSchema = achievementSchema.omit({ id: true });

function revalidateAchievements() {
  revalidateTag('achievements');
  revalidateTag('page:home');   // /home featured achievements
  revalidateTag('page:profil'); // /profil full prestasi
}

export async function createAchievementAction(raw: unknown): Promise<ActionResult<Achievement>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    const input = achievementInputSchema.parse(raw) as AchievementInput;
    const created = await createAchievement(input);
    await writeAudit({ userId: user.id, action: 'create_achievement', target: `achievement:${created.id}` }).catch(() => {});
    revalidateAchievements();
    return created;
  });
}

export async function updateAchievementAction(id: string, raw: unknown): Promise<ActionResult<Achievement>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    const input = achievementInputSchema.parse(raw) as AchievementInput;
    const updated = await updateAchievement(id, input);
    await writeAudit({ userId: user.id, action: 'update_achievement', target: `achievement:${id}` }).catch(() => {});
    revalidateAchievements();
    return updated;
  });
}

export async function deleteAchievementAction(id: string): Promise<ActionResult<void>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    await deleteAchievement(id);
    await writeAudit({ userId: user.id, action: 'delete_achievement', target: `achievement:${id}` }).catch(() => {});
    revalidateAchievements();
  });
}

export async function reorderAchievementsAction(orderedIds: string[]): Promise<ActionResult<void>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    await reorderAchievements(orderedIds);
    await writeAudit({ userId: user.id, action: 'reorder_achievement', target: 'achievement:*' }).catch(() => {});
    revalidateAchievements();
  });
}
```

- [ ] **Step 4.6: Implement faq-actions.ts**

Create `src/app/(admin)/admin/entities/_actions/faq-actions.ts`:
```ts
'use server';

import { revalidateTag } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { withRole, type ActionResult } from '@/lib/auth/server-action-guard';
import { writeAudit } from '@/lib/security/audit';
import { faqSchema } from '@/lib/validation/schemas/entities/faq';
import {
  createFaq, updateFaq, deleteFaq, reorderFaqs, type FaqInput,
} from '@/lib/data/repositories/faq-repo';
import type { Faq } from '@config/types';

const faqInputSchema = faqSchema.omit({ id: true });

function revalidateFaqs() {
  revalidateTag('faqs');
  revalidateTag('page:kontak'); // /kontak lists faq
}

export async function createFaqAction(raw: unknown): Promise<ActionResult<Faq>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    const input = faqInputSchema.parse(raw) as FaqInput;
    const created = await createFaq(input);
    await writeAudit({ userId: user.id, action: 'create_faq', target: `faq:${created.id}` }).catch(() => {});
    revalidateFaqs();
    return created;
  });
}

export async function updateFaqAction(id: string, raw: unknown): Promise<ActionResult<Faq>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    const input = faqInputSchema.parse(raw) as FaqInput;
    const updated = await updateFaq(id, input);
    await writeAudit({ userId: user.id, action: 'update_faq', target: `faq:${id}` }).catch(() => {});
    revalidateFaqs();
    return updated;
  });
}

export async function deleteFaqAction(id: string): Promise<ActionResult<void>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    await deleteFaq(id);
    await writeAudit({ userId: user.id, action: 'delete_faq', target: `faq:${id}` }).catch(() => {});
    revalidateFaqs();
  });
}

export async function reorderFaqsAction(orderedIds: string[]): Promise<ActionResult<void>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    await reorderFaqs(orderedIds);
    await writeAudit({ userId: user.id, action: 'reorder_faq', target: 'faq:*' }).catch(() => {});
    revalidateFaqs();
  });
}
```

- [ ] **Step 4.7: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 4.8: Commit**

```bash
git add 'src/app/(admin)/admin/entities/_actions/' \
        src/__tests__/integration/admin/teacher-actions.test.ts
git commit -m "feat(admin): server actions for Teacher/Achievement/Faq CRUD + cache invalidation"
```

---

## Chunk 3: Generic CRUD UI components

### Task 5: GradientPhotoPicker + DeleteConfirmDialog + shared form primitives

**Why:** Reusable building blocks for entity forms. GradientPhotoPicker edits the Photo gradient union (Phase 2 scope — no upload). DeleteConfirmDialog is the type-name-to-confirm modal. FormField wraps label + input + error.

**Files:**
- Create: `src/components/admin/form/FormField.tsx`
- Create: `src/components/admin/form/GradientPhotoPicker.tsx`
- Create: `src/components/admin/DeleteConfirmDialog.tsx`
- Create: `src/__tests__/components/admin/DeleteConfirmDialog.test.tsx`

- [ ] **Step 5.1: FormField (client)**

Create `src/components/admin/form/FormField.tsx`:
```tsx
'use client';

import type { ReactNode } from 'react';

export function FormField({
  label, htmlFor, error, hint, children,
}: {
  label: string;
  htmlFor: string;
  error?: string | undefined;
  hint?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-neutral-800">
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {hint && !error ? <p className="mt-1 text-xs text-neutral-500">{hint}</p> : null}
      {error ? <p className="mt-1 text-xs text-red-600" role="alert">{error}</p> : null}
    </div>
  );
}

export const inputClass =
  'w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary';
```

- [ ] **Step 5.2: GradientPhotoPicker (client)**

Create `src/components/admin/form/GradientPhotoPicker.tsx`:
```tsx
'use client';

import { inputClass } from './FormField';

export type GradientPhotoValue = { kind: 'gradient'; from: string; to: string; emoji: string };

const PRESET_GRADIENTS: { from: string; to: string; label: string }[] = [
  { from: '#DBEAFE', to: '#93C5FD', label: 'Biru' },
  { from: '#D1FAE5', to: '#6EE7B7', label: 'Hijau' },
  { from: '#FEF9C3', to: '#FDE68A', label: 'Kuning' },
  { from: '#F3E8FF', to: '#C4B5FD', label: 'Ungu' },
  { from: '#FEE2E2', to: '#FCA5A5', label: 'Merah' },
  { from: '#FFF7ED', to: '#FED7AA', label: 'Oranye' },
];

export function GradientPhotoPicker({
  value, onChange,
}: {
  value: GradientPhotoValue;
  onChange: (v: GradientPhotoValue) => void;
}) {
  return (
    <div className="space-y-3">
      <div
        className="flex h-24 w-24 items-center justify-center rounded-xl text-4xl"
        style={{ background: `linear-gradient(135deg, ${value.from}, ${value.to})` }}
        aria-label="Pratinjau foto"
      >
        <span aria-hidden>{value.emoji || '👤'}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {PRESET_GRADIENTS.map((g) => (
          <button
            key={g.label}
            type="button"
            onClick={() => onChange({ ...value, from: g.from, to: g.to })}
            className={`h-8 w-8 rounded-full border-2 ${
              value.from === g.from && value.to === g.to ? 'border-primary' : 'border-transparent'
            }`}
            style={{ background: `linear-gradient(135deg, ${g.from}, ${g.to})` }}
            title={g.label}
            aria-label={`Gradient ${g.label}`}
          />
        ))}
      </div>
      <input
        type="text"
        value={value.emoji}
        onChange={(e) => onChange({ ...value, emoji: e.target.value })}
        placeholder="Emoji (mis. 👩‍🏫)"
        maxLength={4}
        className={inputClass}
        aria-label="Emoji foto"
      />
      <p className="text-xs text-neutral-500">
        Upload foto asli akan tersedia di update berikutnya. Untuk sekarang, pilih warna + emoji.
      </p>
    </div>
  );
}
```

- [ ] **Step 5.3: Write failing test for DeleteConfirmDialog**

Create `src/__tests__/components/admin/DeleteConfirmDialog.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';

describe('DeleteConfirmDialog', () => {
  it('disables confirm until the exact name is typed', () => {
    const onConfirm = jest.fn();
    render(
      <DeleteConfirmDialog
        open
        itemName="Bu Siti"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );
    const confirmBtn = screen.getByRole('button', { name: /hapus permanen/i });
    expect(confirmBtn).toBeDisabled();

    const input = screen.getByLabelText(/ketik nama/i);
    fireEvent.change(input, { target: { value: 'Bu Sit' } });
    expect(confirmBtn).toBeDisabled();

    fireEvent.change(input, { target: { value: 'Bu Siti' } });
    expect(confirmBtn).toBeEnabled();

    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('does not render when open is false', () => {
    const { container } = render(
      <DeleteConfirmDialog open={false} itemName="x" onConfirm={() => {}} onCancel={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('calls onCancel when cancel clicked', () => {
    const onCancel = jest.fn();
    render(<DeleteConfirmDialog open itemName="X" onConfirm={() => {}} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /batal/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 5.4: Run, expect FAIL**

Run: `npm test -- --testPathPattern='DeleteConfirmDialog'`
Expected: FAIL — module not found.

- [ ] **Step 5.5: Implement DeleteConfirmDialog**

Create `src/components/admin/DeleteConfirmDialog.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { inputClass } from './form/FormField';

export function DeleteConfirmDialog({
  open, itemName, onConfirm, onCancel,
}: {
  open: boolean;
  itemName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState('');
  if (!open) return null;
  const matches = typed === itemName;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="font-heading text-lg font-bold text-neutral-900">Hapus &ldquo;{itemName}&rdquo;?</h2>
        <p className="mt-2 text-sm text-neutral-600">
          Tindakan ini permanen dan tidak bisa dibatalkan. Ketik nama persis untuk konfirmasi.
        </p>
        <label htmlFor="delete-confirm-input" className="mt-4 block text-sm font-medium text-neutral-800">
          Ketik nama: <span className="font-mono text-neutral-900">{itemName}</span>
        </label>
        <input
          id="delete-confirm-input"
          className={`mt-1 ${inputClass}`}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
        />
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={!matches}
            onClick={onConfirm}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            Hapus Permanen
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5.6: Run, expect PASS**

Run: `npm test -- --testPathPattern='DeleteConfirmDialog'`
Expected: 3 tests pass.

- [ ] **Step 5.7: Commit**

```bash
git add src/components/admin/form/ src/components/admin/DeleteConfirmDialog.tsx \
        src/__tests__/components/admin/DeleteConfirmDialog.test.tsx
git commit -m "feat(admin): form primitives (FormField, GradientPhotoPicker, DeleteConfirmDialog)"
```

---

### Task 6: Generic EntityTable (list + search + drag-reorder)

**Why:** Reusable list table for all entity pages. Generic over row type. Provides: search filter, drag-reorder (dnd-kit), and per-row actions (Edit, Delete) via render props. Reorder calls a passed `onReorder(ids)` callback.

**Files:**
- Create: `src/components/admin/EntityTable.tsx`
- Create: `src/__tests__/components/admin/EntityTable.test.tsx`

- [ ] **Step 6.1: Write failing test**

Create `src/__tests__/components/admin/EntityTable.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { EntityTable } from '@/components/admin/EntityTable';

type Row = { id: string; name: string; cat: string };
const rows: Row[] = [
  { id: '1', name: 'Alpha', cat: 'x' },
  { id: '2', name: 'Beta', cat: 'y' },
  { id: '3', name: 'Gamma', cat: 'x' },
];

function renderTable(props: Partial<React.ComponentProps<typeof EntityTable<Row>>> = {}) {
  return render(
    <EntityTable<Row>
      rows={rows}
      getId={(r) => r.id}
      getSearchText={(r) => r.name}
      columns={[
        { header: 'Nama', cell: (r) => r.name },
        { header: 'Kategori', cell: (r) => r.cat },
      ]}
      onEdit={props.onEdit ?? (() => {})}
      onDelete={props.onDelete ?? (() => {})}
      onReorder={props.onReorder ?? (() => {})}
      {...props}
    />,
  );
}

describe('EntityTable', () => {
  it('renders all rows', () => {
    renderTable();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('Gamma')).toBeInTheDocument();
  });

  it('filters rows by search text', () => {
    renderTable();
    const search = screen.getByPlaceholderText(/cari/i);
    fireEvent.change(search, { target: { value: 'Bet' } });
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('calls onEdit with the row when Edit clicked', () => {
    const onEdit = jest.fn();
    renderTable({ onEdit });
    fireEvent.click(screen.getAllByRole('button', { name: /edit/i })[0]!);
    expect(onEdit).toHaveBeenCalledWith(rows[0]);
  });

  it('calls onDelete with the row when Delete clicked', () => {
    const onDelete = jest.fn();
    renderTable({ onDelete });
    fireEvent.click(screen.getAllByRole('button', { name: /hapus/i })[0]!);
    expect(onDelete).toHaveBeenCalledWith(rows[0]);
  });

  it('shows empty state when no rows match', () => {
    renderTable();
    fireEvent.change(screen.getByPlaceholderText(/cari/i), { target: { value: 'zzz' } });
    expect(screen.getByText(/tidak ada/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 6.2: Run, expect FAIL**

Run: `npm test -- --testPathPattern='EntityTable'`
Expected: FAIL — module not found.

- [ ] **Step 6.3: Implement EntityTable**

Create `src/components/admin/EntityTable.tsx`:
```tsx
'use client';

import { useMemo, useState } from 'react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export type Column<Row> = {
  header: string;
  cell: (row: Row) => React.ReactNode;
};

export function EntityTable<Row>({
  rows, getId, getSearchText, columns, onEdit, onDelete, onReorder, addButton,
}: {
  rows: Row[];
  getId: (row: Row) => string;
  getSearchText: (row: Row) => string;
  columns: Column<Row>[];
  onEdit: (row: Row) => void;
  onDelete: (row: Row) => void;
  onReorder: (orderedIds: string[]) => void;
  addButton?: React.ReactNode;
}) {
  const [query, setQuery] = useState('');
  // Local order mirror so drag feels instant; server reorder fires onDragEnd.
  const [orderedIds, setOrderedIds] = useState<string[]>(() => rows.map(getId));

  // Keep local order in sync if rows prop changes length/content.
  const rowsById = useMemo(() => {
    const m = new Map<string, Row>();
    for (const r of rows) m.set(getId(r), r);
    return m;
  }, [rows, getId]);

  // Reconcile: if server rows changed, reset local order to match.
  const serverIds = rows.map(getId).join(',');
  useMemo(() => {
    setOrderedIds(rows.map(getId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverIds]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const visibleIds = orderedIds.filter((id) => {
    const row = rowsById.get(id);
    if (!row) return false;
    if (!query.trim()) return true;
    return getSearchText(row).toLowerCase().includes(query.trim().toLowerCase());
  });

  const dragDisabled = query.trim().length > 0; // reordering only meaningful on full list

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedIds.indexOf(String(active.id));
    const newIndex = orderedIds.indexOf(String(over.id));
    const next = arrayMove(orderedIds, oldIndex, newIndex);
    setOrderedIds(next);
    onReorder(next);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <input
          type="search"
          placeholder="Cari…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-64 rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {addButton}
      </div>

      {visibleIds.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-500">
          Tidak ada data.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={visibleIds} strategy={verticalListSortingStrategy}>
              <table className="w-full text-left text-sm">
                <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="w-8 px-3 py-2" aria-label="Urutkan" />
                    {columns.map((c) => (
                      <th key={c.header} className="px-3 py-2">{c.header}</th>
                    ))}
                    <th className="px-3 py-2 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleIds.map((id) => {
                    const row = rowsById.get(id)!;
                    return (
                      <SortableRow
                        key={id}
                        id={id}
                        dragDisabled={dragDisabled}
                        columns={columns}
                        row={row}
                        onEdit={() => onEdit(row)}
                        onDelete={() => onDelete(row)}
                      />
                    );
                  })}
                </tbody>
              </table>
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
}

function SortableRow<Row>({
  id, row, columns, onEdit, onDelete, dragDisabled,
}: {
  id: string;
  row: Row;
  columns: Column<Row>[];
  onEdit: () => void;
  onDelete: () => void;
  dragDisabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: dragDisabled });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <tr ref={setNodeRef} style={style} className="border-b border-neutral-100 last:border-0">
      <td className="px-3 py-2 align-middle">
        <button
          type="button"
          className="cursor-grab text-neutral-400 disabled:cursor-not-allowed disabled:opacity-30"
          disabled={dragDisabled}
          aria-label="Seret untuk urutkan"
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
      </td>
      {columns.map((c) => (
        <td key={c.header} className="px-3 py-2 align-middle text-neutral-800">{c.cell(row)}</td>
      ))}
      <td className="px-3 py-2 text-right align-middle">
        <button type="button" onClick={onEdit} className="mr-2 text-sm font-medium text-primary hover:underline">
          Edit
        </button>
        <button type="button" onClick={onDelete} className="text-sm font-medium text-red-600 hover:underline">
          Hapus
        </button>
      </td>
    </tr>
  );
}
```

- [ ] **Step 6.4: Run, expect PASS**

Run: `npm test -- --testPathPattern='EntityTable'`
Expected: 5 tests pass.

Note: jsdom doesn't fully support pointer-based drag, so the test doesn't exercise actual drag — only render/search/edit/delete/empty. That's acceptable; drag is covered by Playwright E2E in Task 8.

- [ ] **Step 6.5: Commit**

```bash
git add src/components/admin/EntityTable.tsx src/__tests__/components/admin/EntityTable.test.tsx
git commit -m "feat(admin): generic EntityTable (list, search, drag-reorder)"
```

---

## Chunk 4: Entity pages (Teacher, Achievement, Faq) + E2E

### Task 7: Entity drawer + 3 entity pages

**Why:** Wire it all together. Each entity page is a server component that loads rows + renders a client `<EntityManager>` (table + drawer form). The drawer uses react-hook-form + zodResolver. This is the largest task — but the 3 entities share the EntityManager shell; only column config + form fields differ.

**Files:**
- Create: `src/components/admin/EntityDrawer.tsx`
- Create: `src/app/(admin)/admin/entities/teachers/page.tsx`
- Create: `src/app/(admin)/admin/entities/teachers/TeacherManager.tsx`
- Create: `src/app/(admin)/admin/entities/achievements/page.tsx`
- Create: `src/app/(admin)/admin/entities/achievements/AchievementManager.tsx`
- Create: `src/app/(admin)/admin/entities/faqs/page.tsx`
- Create: `src/app/(admin)/admin/entities/faqs/FaqManager.tsx`

- [ ] **Step 7.1: EntityDrawer (client — generic slide-in panel)**

Create `src/components/admin/EntityDrawer.tsx`:
```tsx
'use client';

import { useEffect, type ReactNode } from 'react';

export function EntityDrawer({
  open, title, onClose, children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden />
      <aside
        className="relative z-10 flex h-full w-full max-w-md flex-col bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <h2 className="font-heading text-lg font-bold text-neutral-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Tutup" className="text-neutral-400 hover:text-neutral-700">
            ✕
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </aside>
    </div>
  );
}
```

- [ ] **Step 7.2: TeacherManager (client — table + drawer + form)**

Create `src/app/(admin)/admin/entities/teachers/TeacherManager.tsx`:
```tsx
'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Teacher } from '@config/types';
import { EntityTable } from '@/components/admin/EntityTable';
import { EntityDrawer } from '@/components/admin/EntityDrawer';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import { FormField, inputClass } from '@/components/admin/form/FormField';
import { GradientPhotoPicker, type GradientPhotoValue } from '@/components/admin/form/GradientPhotoPicker';
import {
  createTeacherAction, updateTeacherAction, deleteTeacherAction, reorderTeachersAction,
} from '@/app/(admin)/admin/entities/_actions/teacher-actions';

const formSchema = z.object({
  name: z.string().min(1, 'Nama wajib diisi'),
  position: z.string().min(1, 'Jabatan wajib diisi'),
  badge: z.string(),
  category: z.enum(['pimpinan', 'guru', 'tu']),
  emoji: z.string().min(1, 'Emoji wajib diisi'),
  from: z.string().min(1),
  to: z.string().min(1),
});
type FormValues = z.infer<typeof formSchema>;

const CATEGORY_LABEL: Record<Teacher['category'], string> = {
  pimpinan: 'Pimpinan', guru: 'Guru', tu: 'Tata Usaha',
};

export function TeacherManager({ initialTeachers }: { initialTeachers: Teacher[] }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [deleting, setDeleting] = useState<Teacher | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } =
    useForm<FormValues>({ resolver: zodResolver(formSchema) });

  function openCreate() {
    setEditing(null);
    setFormError(null);
    reset({ name: '', position: '', badge: '', category: 'guru', emoji: '👤', from: '#DBEAFE', to: '#93C5FD' });
    setDrawerOpen(true);
  }

  function openEdit(t: Teacher) {
    setEditing(t);
    setFormError(null);
    const g = t.photo.kind === 'gradient' ? t.photo : { from: '#DBEAFE', to: '#93C5FD', emoji: '👤' };
    reset({
      name: t.name, position: t.position, badge: t.badge, category: t.category,
      emoji: g.emoji, from: g.from, to: g.to,
    });
    setDrawerOpen(true);
  }

  function toInput(v: FormValues) {
    const photo: GradientPhotoValue = { kind: 'gradient', from: v.from, to: v.to, emoji: v.emoji };
    return { name: v.name, position: v.position, badge: v.badge, category: v.category, photo };
  }

  function onSubmit(v: FormValues) {
    setFormError(null);
    startTransition(async () => {
      const result = editing
        ? await updateTeacherAction(editing.id, toInput(v))
        : await createTeacherAction(toInput(v));
      if (result.ok) {
        setDrawerOpen(false);
      } else {
        setFormError(result.error === 'forbidden' ? 'Anda tidak punya izin.' : result.error);
      }
    });
  }

  function confirmDelete() {
    if (!deleting) return;
    const id = deleting.id;
    startTransition(async () => {
      const result = await deleteTeacherAction(id);
      if (result.ok) setDeleting(null);
      else setFormError(result.error);
    });
  }

  function handleReorder(ids: string[]) {
    startTransition(async () => { await reorderTeachersAction(ids); });
  }

  const photoValue: GradientPhotoValue = {
    kind: 'gradient', from: watch('from') ?? '#DBEAFE', to: watch('to') ?? '#93C5FD', emoji: watch('emoji') ?? '👤',
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-extrabold text-neutral-900">Guru &amp; Staf</h1>
          <p className="text-sm text-neutral-600">Kelola daftar guru dan staf yang tampil di halaman Profil.</p>
        </div>
      </div>

      <EntityTable<Teacher>
        rows={initialTeachers}
        getId={(t) => t.id}
        getSearchText={(t) => `${t.name} ${t.position}`}
        columns={[
          { header: 'Nama', cell: (t) => <span className="font-medium">{t.name}</span> },
          { header: 'Jabatan', cell: (t) => t.position },
          { header: 'Kategori', cell: (t) => CATEGORY_LABEL[t.category] },
        ]}
        onEdit={openEdit}
        onDelete={(t) => setDeleting(t)}
        onReorder={handleReorder}
        addButton={
          <button
            type="button"
            onClick={openCreate}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
          >
            + Tambah Guru
          </button>
        }
      />

      <EntityDrawer open={drawerOpen} title={editing ? 'Edit Guru' : 'Tambah Guru'} onClose={() => setDrawerOpen(false)}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Nama" htmlFor="t-name" error={errors.name?.message}>
            <input id="t-name" className={inputClass} {...register('name')} />
          </FormField>
          <FormField label="Jabatan" htmlFor="t-position" error={errors.position?.message}>
            <input id="t-position" className={inputClass} {...register('position')} />
          </FormField>
          <FormField label="Gelar / Badge" htmlFor="t-badge" hint="mis. S.Pd., M.Pd." error={errors.badge?.message}>
            <input id="t-badge" className={inputClass} {...register('badge')} />
          </FormField>
          <FormField label="Kategori" htmlFor="t-category" error={errors.category?.message}>
            <select id="t-category" className={inputClass} {...register('category')}>
              <option value="pimpinan">Pimpinan</option>
              <option value="guru">Guru</option>
              <option value="tu">Tata Usaha</option>
            </select>
          </FormField>
          <FormField label="Foto" htmlFor="t-photo" error={errors.emoji?.message}>
            <GradientPhotoPicker
              value={photoValue}
              onChange={(v) => {
                setValue('from', v.from);
                setValue('to', v.to);
                setValue('emoji', v.emoji);
              }}
            />
          </FormField>
          {formError ? <p className="text-sm text-red-600" role="alert">{formError}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setDrawerOpen(false)} className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100">
              Batal
            </button>
            <button type="submit" disabled={isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50">
              {isPending ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </form>
      </EntityDrawer>

      <DeleteConfirmDialog
        open={deleting !== null}
        itemName={deleting?.name ?? ''}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
```

- [ ] **Step 7.3: Teachers page (server component)**

Create `src/app/(admin)/admin/entities/teachers/page.tsx`:
```tsx
import { auth } from '@/lib/auth/config';
import { AdminShell } from '@/components/admin/AdminShell';
import { getTeachers } from '@/lib/data/repositories/teacher-repo';
import { TeacherManager } from './TeacherManager';

export const dynamic = 'force-dynamic';

export default async function TeachersPage() {
  const session = await auth();
  const teachers = await getTeachers();
  return (
    <AdminShell userName={session?.user.name ?? 'Admin'} role={session?.user.role ?? 'EDITOR'}>
      <TeacherManager initialTeachers={teachers} />
    </AdminShell>
  );
}
```

- [ ] **Step 7.4: AchievementManager + page**

Create `src/app/(admin)/admin/entities/achievements/AchievementManager.tsx` — mirror TeacherManager but simpler (no photo). Form fields: year (number), title, recipient, organizer, level (select: kabupaten/provinsi/nasional/internasional), icon (emoji text input). Reuse EntityTable + EntityDrawer + DeleteConfirmDialog. Form schema:
```ts
const formSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  title: z.string().min(1, 'Judul wajib diisi'),
  recipient: z.string().min(1, 'Penerima wajib diisi'),
  organizer: z.string().min(1, 'Penyelenggara wajib diisi'),
  level: z.enum(['kabupaten', 'provinsi', 'nasional', 'internasional']),
  icon: z.string().min(1, 'Ikon wajib diisi'),
});
```
Columns: Tahun, Judul, Penerima, Tingkat. Search text: `${title} ${recipient}`. Item name for delete: `title`. Use `createAchievementAction`/`updateAchievementAction`/`deleteAchievementAction`/`reorderAchievementsAction`. Follow the exact structure of TeacherManager (state, useForm, openCreate/openEdit/onSubmit/confirmDelete/handleReorder, EntityTable + EntityDrawer + DeleteConfirmDialog).

Create `src/app/(admin)/admin/entities/achievements/page.tsx`:
```tsx
import { auth } from '@/lib/auth/config';
import { AdminShell } from '@/components/admin/AdminShell';
import { getAllAchievements } from '@/lib/data/repositories/achievement-repo';
import { AchievementManager } from './AchievementManager';

export const dynamic = 'force-dynamic';

export default async function AchievementsPage() {
  const session = await auth();
  const items = await getAllAchievements();
  return (
    <AdminShell userName={session?.user.name ?? 'Admin'} role={session?.user.role ?? 'EDITOR'}>
      <AchievementManager initialAchievements={items} />
    </AdminShell>
  );
}
```

- [ ] **Step 7.5: FaqManager + page**

Create `src/app/(admin)/admin/entities/faqs/FaqManager.tsx` — mirror pattern. Form fields: question (text), answer (textarea), category (select: ppdb/akademik/administrasi/lainnya). Form schema:
```ts
const formSchema = z.object({
  question: z.string().min(1, 'Pertanyaan wajib diisi'),
  answer: z.string().min(1, 'Jawaban wajib diisi'),
  category: z.enum(['ppdb', 'akademik', 'administrasi', 'lainnya']),
});
```
Columns: Pertanyaan, Kategori. Search text: `question`. Item name for delete: `question` (truncate display if long, but pass full for confirm). Use faq actions.

For the answer field use a `<textarea>` instead of `<input>`:
```tsx
<textarea id="f-answer" rows={4} className={inputClass} {...register('answer')} />
```

Create `src/app/(admin)/admin/entities/faqs/page.tsx`:
```tsx
import { auth } from '@/lib/auth/config';
import { AdminShell } from '@/components/admin/AdminShell';
import { getFaqs } from '@/lib/data/repositories/faq-repo';
import { FaqManager } from './FaqManager';

export const dynamic = 'force-dynamic';

export default async function FaqsPage() {
  const session = await auth();
  const items = await getFaqs();
  return (
    <AdminShell userName={session?.user.name ?? 'Admin'} role={session?.user.role ?? 'EDITOR'}>
      <FaqManager initialFaqs={items} />
    </AdminShell>
  );
}
```

- [ ] **Step 7.6: Typecheck + lint + build**

Run: `npm run typecheck && npm run lint && SKIP_ENV_VALIDATION=true npm run build`
Expected: clean. New routes `/admin/entities/teachers`, `/admin/entities/achievements`, `/admin/entities/faqs` registered.

- [ ] **Step 7.7: Commit**

```bash
git add src/components/admin/EntityDrawer.tsx 'src/app/(admin)/admin/entities/'
git commit -m "feat(admin): entity CRUD pages for Teacher, Achievement, Faq (table + drawer form)"
```

---

### Task 8: E2E — Teacher CRUD full flow

**Why:** Verify the whole flow in a real browser: login → navigate to Guru → add → edit → delete → and confirm change reflects on public /profil page.

**Files:**
- Create: `playwright/tests/admin-teacher-crud.spec.ts`

- [ ] **Step 8.1: Write E2E**

Create `playwright/tests/admin-teacher-crud.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill('e2e@smpn3.test');
  await page.getByLabel('Password').fill('e2e-password-123');
  await page.getByRole('button', { name: /masuk/i }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard/);
}

test.describe('admin teacher CRUD', () => {
  test('add a teacher → appears in list → appears on public /profil', async ({ page }) => {
    await login(page);
    await page.goto('/admin/entities/teachers');
    await expect(page.getByRole('heading', { name: /guru & staf/i })).toBeVisible();

    await page.getByRole('button', { name: /tambah guru/i }).click();
    const uniqueName = `E2E Guru ${Date.now()}`;
    await page.getByLabel('Nama').fill(uniqueName);
    await page.getByLabel('Jabatan').fill('Guru Uji');
    await page.getByLabel('Gelar / Badge').fill('S.Pd.');
    // category defaults to 'guru'; emoji defaults to 👤
    await page.getByRole('button', { name: /^simpan$/i }).click();

    // Row appears in admin list
    await expect(page.getByText(uniqueName)).toBeVisible();

    // Public /profil shows the new teacher (cache revalidated)
    await page.goto('/profil');
    await expect(page.getByText(uniqueName)).toBeVisible();
  });

  test('edit a teacher updates the row', async ({ page }) => {
    await login(page);
    await page.goto('/admin/entities/teachers');
    await page.getByRole('button', { name: /tambah guru/i }).click();
    const name = `Edit Target ${Date.now()}`;
    await page.getByLabel('Nama').fill(name);
    await page.getByLabel('Jabatan').fill('Awal');
    await page.getByLabel('Gelar / Badge').fill('S.Pd.');
    await page.getByRole('button', { name: /^simpan$/i }).click();
    await expect(page.getByText(name)).toBeVisible();

    // Edit it
    await page.getByText(name).locator('xpath=ancestor::tr').getByRole('button', { name: /edit/i }).click();
    await page.getByLabel('Jabatan').fill('Diubah');
    await page.getByRole('button', { name: /^simpan$/i }).click();
    await expect(page.getByText('Diubah')).toBeVisible();
  });

  test('delete a teacher requires typing the name', async ({ page }) => {
    await login(page);
    await page.goto('/admin/entities/teachers');
    await page.getByRole('button', { name: /tambah guru/i }).click();
    const name = `Delete Target ${Date.now()}`;
    await page.getByLabel('Nama').fill(name);
    await page.getByLabel('Jabatan').fill('Hapus');
    await page.getByLabel('Gelar / Badge').fill('S.Pd.');
    await page.getByRole('button', { name: /^simpan$/i }).click();
    await expect(page.getByText(name)).toBeVisible();

    await page.getByText(name).locator('xpath=ancestor::tr').getByRole('button', { name: /hapus/i }).click();
    const confirmBtn = page.getByRole('button', { name: /hapus permanen/i });
    await expect(confirmBtn).toBeDisabled();
    await page.getByLabel(/ketik nama/i).fill(name);
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();
    await expect(page.getByText(name)).toHaveCount(0);
  });
});
```

- [ ] **Step 8.2: Run E2E**

Run: `npm run e2e -- playwright/tests/admin-teacher-crud.spec.ts`
Expected: 3 tests pass.

Note: the test runs against `NEXT_PUBLIC_DATA_SOURCE=api` (set in Phase 1). The seed-content global-setup already populates base data. New teachers added during the test persist for the test session. The `Date.now()` suffix keeps names unique across re-runs (avoids collision with leftover rows).

If the public /profil assertion fails because of `unstable_cache`: the `revalidateTag('teachers')` + `revalidateTag('page:profil')` should bust it. If it still serves stale, check that the action actually calls revalidateTag (Task 4) and that /profil page is `dynamic`/ISR not fully static.

- [ ] **Step 8.3: Run full E2E suite (no regressions)**

Run: `npm run e2e`
Expected: prior 15 + new 3 = 18 tests pass.

- [ ] **Step 8.4: Commit**

```bash
git add playwright/tests/admin-teacher-crud.spec.ts
git commit -m "test(e2e): admin teacher CRUD full flow (add/edit/delete + public reflect)"
```

---

### Task 9: Final verification + README

**Files:**
- Modify: `README.md` (Phase 2a status note)

- [ ] **Step 9.1: Full verification**

```bash
npm run lint
npm run typecheck
npm test
npm run test:int
npm run e2e
SKIP_ENV_VALIDATION=true npm run build
```

Expected: all green.

- [ ] **Step 9.2: Manual smoke**

Run dev server (`DATABASE_URL=... PORT=3001 npm run dev`), then:
- Login → dashboard shows 3 cards
- Sidebar navigation works (Guru, Prestasi, FAQ)
- Add a guru → appears in list + on /profil
- Edit → updates
- Delete (type name) → removed
- Search filters list
- Drag-reorder a row (manual)
- Same flow for Achievement + FAQ

Stop server.

- [ ] **Step 9.3: Update README**

Add to the Status block:
```markdown
**Phase 2a (Admin CRUD foundation): ✅ Complete** — admin shell (sidebar + topbar), generic CRUD scaffolding (table + drawer form + delete confirm), server actions with cache invalidation + audit, dan CRUD penuh untuk Guru, Prestasi, FAQ. Foto pakai gradient + emoji picker (upload foto asli di Phase 3). Phase 2b akan menambah entity sisanya + editor SiteConfig/Navigation.
```

- [ ] **Step 9.4: Commit**

```bash
git add README.md
git commit -m "docs(phase-2a): mark admin CRUD foundation complete"
```

---

## Phase 2a Done Criteria

- [ ] Deps installed: react-hook-form, @hookform/resolvers, @dnd-kit/*
- [ ] `withRole` server-action guard + tests
- [ ] Admin shell (sidebar + topbar) + dashboard cards
- [ ] Write functions (create/update/delete/reorder) for Teacher, Achievement, Faq repos + integration tests
- [ ] Server actions for all 3 entities with `revalidateTag` + `writeAudit`, returning typed `ActionResult`
- [ ] EntityTable (list, search, drag-reorder) + tests
- [ ] EntityDrawer + DeleteConfirmDialog (type-name-to-confirm) + GradientPhotoPicker + FormField
- [ ] 3 entity pages (teachers, achievements, faqs) each with Manager component
- [ ] react-hook-form + zodResolver validation in forms
- [ ] E2E: teacher CRUD full flow + public reflect (3 tests)
- [ ] All tests green: unit + integration + e2e (18 total e2e)
- [ ] `npm run build` clean, lint + typecheck clean
- [ ] CRUD changes reflect on public site (cache invalidated)
- [ ] Audit log per mutation
- [ ] README updated

---

## What's NOT in Phase 2a (deferred to 2b / later)

- ❌ Extracurricular, Subject, GalleryItem, Facility, OrganizationMember CRUD → **Phase 2b** (replicate the EntityManager pattern)
- ❌ SiteConfig + Navigation singleton editors → **Phase 2b**
- ❌ DocumentSlot (PDF) management → **Phase 2b** (or Phase 3 with Cloudinary)
- ❌ User management UI → **Phase 2b** or Phase 5
- ❌ Foto upload (Cloudinary) → **Phase 3**
- ❌ Inline editor → **Phase 4**
- ❌ EDITOR-vs-ADMIN field-level restrictions (Phase 2a allows both roles full CRUD on these 3 entities; SiteConfig/Navigation read-only-for-EDITOR enforced in Phase 2b when those editors land)
