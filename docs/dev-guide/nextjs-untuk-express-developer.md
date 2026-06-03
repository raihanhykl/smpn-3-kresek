# Next.js 15 (App Router) untuk Express Developer

Panduan singkat untuk memahami arsitektur project ini dari sudut pandang seorang Express.js developer. Semua konsep Express punya padanan di Next.js — namanya saja yang beda.

---

## TL;DR — peta padanan

| Express.js | Next.js 15 (App Router) | File / lokasi di project |
|---|---|---|
| `app.use(...)` middleware | `middleware.ts` (Edge) | [src/middleware.ts](../../src/middleware.ts) |
| `app.get('/users/:id', handler)` | `app/users/[id]/page.tsx` (default export) | [src/app/profil/page.tsx](../../src/app/profil/page.tsx) |
| `app.post('/api/login', handler)` | Server Action (`'use server'`) ATAU `app/api/.../route.ts` | [src/app/(admin)/admin/login/actions.ts](../../src/app/(admin)/admin/login/actions.ts) |
| `app.get('/api/health', handler)` | `app/api/health/route.ts` `export GET` | [src/app/api/health/route.ts](../../src/app/api/health/route.ts) |
| `res.json({...})` | `return NextResponse.json({...})` | sama |
| `res.redirect('/login')` | `redirect('/login')` dari `next/navigation` | sama |
| `req.body` (POST data) | `formData.get('email')` dari Server Action arg | sama |
| `req.cookies` | `cookies()` dari `next/headers` | — |
| `req.headers` | `headers()` dari `next/headers` | [src/lib/auth/config.ts:25](../../src/lib/auth/config.ts) |
| Render template engine (EJS/Pug) | Server Component (default export dari `page.tsx`) | semua `page.tsx` |
| `app.listen(3000)` | `npm run start` (auto-handled) | tidak perlu nulis |

---

## 1. Filesystem-based routing

Express:
```js
app.get('/profil', (req, res) => res.send('Profil page'));
app.get('/admin/login', (req, res) => res.send('Login page'));
app.post('/admin/login', loginHandler);
```

Next.js:
```
src/app/
├── profil/page.tsx                  → GET /profil
├── (admin)/admin/login/
│   ├── page.tsx                     → GET /admin/login (render form)
│   └── actions.ts                   → Server Action (handles form POST)
└── api/health/route.ts              → GET /api/health
```

**Aturan:**
- `page.tsx` di folder X → halaman publik di URL X
- `route.ts` di folder X → API endpoint di URL X (export `GET`, `POST`, dst.)
- Folder dengan `(nama)` adalah **route group** — tidak masuk URL, hanya untuk organisasi (contoh: `(admin)` adalah group, URL-nya tetap `/admin/...`)
- Folder dengan `[nama]` adalah **dynamic param** — contoh `app/users/[id]/page.tsx` = `/users/:id`

---

## 2. Tiga jenis "handler" di Next.js — kapan pakai yang mana?

Express punya **1 jenis handler**: `(req, res) => {}`.

Next.js punya **3**, dan ini source of confusion utama:

### A) Server Component (default `page.tsx`)

Mirip dengan render template di Express. Function async yang return JSX (HTML).

```tsx
// src/app/profil/page.tsx
import { prisma } from '@/lib/db/client';

// ini server-side, async, jalan di server saat request masuk
export default async function ProfilPage() {
  const teachers = await prisma.teacher.findMany();  // ← langsung query DB, no fetch
  return <div>{teachers.map(t => <p>{t.name}</p>)}</div>;
}
```

**Ekuivalen Express:**
```js
app.get('/profil', async (req, res) => {
  const teachers = await db.teacher.findMany();
  res.render('profil', { teachers });  // pakai EJS/Pug
});
```

**Bedanya:** di Next.js, "template" dan "handler" jadi satu function. Tidak perlu res.render.

### B) Server Action (`'use server'` function)

Form handler. Mirip Express POST endpoint, tapi **type-safe** dan **tidak butuh URL endpoint terpisah**.

```ts
// src/app/(admin)/admin/login/actions.ts
'use server';

export async function loginAction(prev, formData) {
  const email = formData.get('email');
  const password = formData.get('password');
  // validate, signIn, redirect — semua di sini
}
```

Form di client component panggil action langsung:
```tsx
<form action={loginAction}>
  <input name="email" />
  <button type="submit">Login</button>
</form>
```

**Ekuivalen Express:**
```js
// Routes
app.post('/admin/login', async (req, res) => {
  const { email, password } = req.body;
  // validate, login, redirect
  res.redirect('/admin/dashboard');
});

// HTML
<form action="/admin/login" method="POST">
  <input name="email" />
  <button type="submit">Login</button>
</form>
```

**Bedanya:** Server Action tidak butuh URL. Next.js otomatis bikin endpoint random untuknya (lihat Network tab di browser). Plus, return value dari action otomatis kembali ke client (untuk show error message tanpa redirect).

### C) Route Handler (`app/api/.../route.ts`)

Pure REST API endpoint. Mirip Express paling persis.

```ts
// src/app/api/health/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  } catch {
    return NextResponse.json({ status: 'degraded' }, { status: 503 });
  }
}
```

**Ekuivalen Express:**
```js
app.get('/api/health', async (req, res) => {
  try {
    await db.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'degraded' });
  }
});
```

**Hampir persis sama.** Bedanya: `export async function GET` bukan `app.get`.

### Kapan pakai yang mana?

| Skenario | Pakai |
|---|---|
| Render halaman dengan data | **Server Component** (`page.tsx`) |
| Form submit untuk action (login, save, delete) | **Server Action** (`actions.ts`) |
| Endpoint REST untuk client lain (mobile app, webhook, health check) | **Route Handler** (`route.ts`) |

Di project ini:
- Form login → Server Action (`login/actions.ts`)
- Form change password → Server Action (`change-password/actions.ts`)
- Health check → Route Handler (`api/health/route.ts`)
- NextAuth endpoints → Route Handler (`api/auth/[...nextauth]/route.ts`)
- Public pages → Server Component (`page.tsx` di setiap folder)

---

## 3. Middleware

**Sangat mirip dengan Express.**

Express:
```js
app.use((req, res, next) => {
  if (!req.session?.user && req.path.startsWith('/admin')) {
    return res.redirect('/login');
  }
  next();
});
```

Next.js:
```ts
// src/middleware.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/edge';

export default async function middleware(req) {
  const session = await auth();
  if (!session?.user && req.nextUrl.pathname.startsWith('/admin')) {
    return NextResponse.redirect(new URL('/admin/login', req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],  // hanya jalan untuk URL yang match ini
};
```

**Perbedaan penting:**
- Next.js middleware jalan di **Edge runtime** (Cloudflare Workers-like), bukan Node.js penuh
- Edge tidak bisa import Prisma, bcrypt, dll. → harus pakai library yang Edge-compatible
- **Di project ini, kami split NextAuth jadi 2:**
  - `src/lib/auth/edge.ts` — Edge-safe (untuk middleware)
  - `src/lib/auth/config.ts` — Node-full (untuk Server Actions, server components)

Kalau Anda akrab dengan Cloudflare Workers atau Deno Deploy — itu konsep yang sama dengan Edge runtime di Next.js.

---

## 4. Database (Prisma — SAMA persis dengan Express!)

Tidak ada perbedaan dengan Express. Prisma works the same way.

```ts
// src/lib/db/client.ts
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
```

```ts
// Pakai di mana saja (Server Component, Server Action, Route Handler)
const user = await prisma.user.findUnique({ where: { email } });
await prisma.user.update({ where: { id }, data: { lastLoginAt: new Date() } });
```

Migrations, schema, query API — **semua identik** dengan Express + Prisma.

---

## 5. Environment variables

Express:
```js
require('dotenv').config();
const dbUrl = process.env.DATABASE_URL;
```

Next.js:
- `.env.local` file di project root (sudah ada)
- Otomatis dimuat — tidak perlu `require('dotenv')`
- Untuk type safety + validation, project ini pakai `@t3-oss/env-nextjs`:

```ts
// src/lib/env.ts
import { env } from '@/lib/env';
// env.DATABASE_URL → string (validated, type-safe)
```

---

## 6. Authentication (NextAuth.js — analog dengan Passport.js)

| Passport.js | NextAuth v5 |
|---|---|
| `LocalStrategy` | `Credentials` provider |
| `passport.authenticate('local')` | `signIn('credentials', {...})` |
| `req.user` | `auth()` (returns session) |
| `req.logout()` | `signOut()` |
| `req.isAuthenticated()` | `(await auth())?.user != null` |

Di project ini:
- Login: `signIn('credentials', { email, password, redirectTo })` (di `login/actions.ts`)
- Get current user: `await auth()` (di mana saja server-side)
- Logout: `signOut({ redirectTo: '/admin/login' })`
- Protect route: di `middleware.ts` (cek `auth()`)

---

## 7. Hal-hal yang tidak ada di Express

Beberapa fitur Next.js yang Anda akan temui yang tidak ada padanannya di Express:

### a) Client Component vs Server Component

```tsx
'use client';  // ← directive di baris pertama
```

File dengan `'use client'` jalan di **browser** (bukan server). Butuh ini untuk:
- `useState`, `useEffect`, event handlers (onClick, dst)
- Browser APIs (localStorage, window)
- Library yang akses DOM

Tanpa `'use client'` → file jalan di server.

**Aturan praktis:** Default Server Component. Tambah `'use client'` kalau perlu interaktivitas.

### b) Streaming / Suspense

```tsx
import { Suspense } from 'react';
<Suspense fallback={<Loading />}>
  <SlowComponent />
</Suspense>
```

Mirip dengan render partial di Express, tapi otomatis.

### c) ISR (Incremental Static Regeneration)

Halaman bisa di-cache static-style tapi auto-refresh kalau data berubah:
```ts
export const revalidate = 60;  // refresh cache tiap 60 detik
// atau on-demand:
revalidatePath('/profil');     // panggil ini saat data berubah
```

**Akan dipakai di Phase 1** untuk real-time publish konten admin → public site.

---

## 8. Kalau bingung, gunakan analogi ini

> **Next.js App Router itu Express dengan beberapa keajaiban:**
> 1. Routing otomatis dari struktur folder (`page.tsx`, `route.ts`)
> 2. Templating + routing jadi satu function (Server Component)
> 3. Form handler tanpa URL endpoint (Server Action)
> 4. Built-in middleware (`middleware.ts`)
> 5. Authentication library opinionated (NextAuth)

Semua "keajaiban" itu tetap pakai konsep yang sama dengan Express — request masuk, ada handler, query DB, return response. Cara nulisnya saja yang beda.

---

## 9. Cheatsheet command

```bash
npm run dev              # = nodemon. Auto-reload.
npm run build            # = compile production. Output ke .next/
npm run start            # = jalankan production build
npm run lint             # = ESLint
npm run typecheck        # = tsc --noEmit
npm test                 # = unit tests (Jest)
npm run test:int         # = integration tests (Jest + real MySQL)
npm run e2e              # = E2E tests (Playwright + browser)

npm run db:migrate       # = prisma migrate dev (apply schema change)
npm run db:seed          # = seed admin user
npm run db:studio        # = GUI to browse DB (browser-based)
```

---

## 10. Where to read more (in order of usefulness for this project)

1. **Server Components**: https://nextjs.org/docs/app/getting-started/server-and-client-components
2. **Server Actions**: https://nextjs.org/docs/app/getting-started/updating-data#forms (THE most important concept)
3. **Middleware**: https://nextjs.org/docs/app/api-reference/file-conventions/middleware
4. **Route Handlers**: https://nextjs.org/docs/app/api-reference/file-conventions/route
5. **NextAuth v5 Credentials**: https://authjs.dev/getting-started/authentication/credentials

---

## 11. Saat ragu, lihat code project langsung

Project Phase 0 punya **contoh nyata** untuk setiap konsep di atas. Lihat:

| Konsep | Lihat file |
|---|---|
| Server Component | [src/app/profil/page.tsx](../../src/app/profil/page.tsx) |
| Server Component dengan auth check | [src/app/(admin)/admin/dashboard/page.tsx](../../src/app/(admin)/admin/dashboard/page.tsx) |
| Server Action (form handler) | [src/app/(admin)/admin/login/actions.ts](../../src/app/(admin)/admin/login/actions.ts) |
| Client Component (form UI) | [src/app/(admin)/admin/login/LoginForm.tsx](../../src/app/(admin)/admin/login/LoginForm.tsx) |
| Route Handler (REST endpoint) | [src/app/api/health/route.ts](../../src/app/api/health/route.ts) |
| Middleware (Edge) | [src/middleware.ts](../../src/middleware.ts) |
| Pure logic extracted (testable) | [src/lib/auth/middleware-policy.ts](../../src/lib/auth/middleware-policy.ts) |
| Prisma usage | [src/lib/db/client.ts](../../src/lib/db/client.ts) |
| NextAuth config | [src/lib/auth/config.ts](../../src/lib/auth/config.ts) |
| Env validation | [src/lib/env.ts](../../src/lib/env.ts) |

Lihat juga walk-through line-by-line di **[walkthrough-phase-0.md](./walkthrough-phase-0.md)**.
