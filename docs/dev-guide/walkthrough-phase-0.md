# Walk-through Code Phase 0 (untuk Express Developer)

Penjelasan **line-by-line** setiap file penting di Phase 0, dengan ekuivalen Express di sampingnya. Tujuan: setelah baca dokumen ini, Anda bisa edit/maintain code ini tanpa belajar Next.js dari nol.

**Prasyarat:** Baca dulu [nextjs-untuk-express-developer.md](./nextjs-untuk-express-developer.md) untuk konsep dasar.

---

## Daftar isi

1. [Database client](#1-database-client-srclibdbclientts)
2. [Env validation](#2-env-validation-srclibenvts)
3. [Password helpers](#3-password-helpers-srclibauthpasswordts)
4. [Rate limiter](#4-rate-limiter-srclibauthrate-limitts)
5. [requireRole guard](#5-requirerole-guard-srclibauthrequire-rolets)
6. [Audit log writer](#6-audit-log-writer-srclibsecurityauditts)
7. [NextAuth config (yang paling kompleks)](#7-nextauth-config-srclibauthconfigts)
8. [Middleware](#8-middleware-srcmiddlewarets)
9. [Login flow (Server Action + Form)](#9-login-flow)
10. [Change-password flow](#10-change-password-flow)
11. [Dashboard](#11-dashboard-srcappadminadmindashboard)
12. [Health check](#12-health-check-srcappapihealthroutets)

---

## 1. Database client (`src/lib/db/client.ts`)

```ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

**Ekuivalen Express:**
```js
// db.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
module.exports = { prisma };
```

**Kenapa lebih ribet di Next.js?**
- Mode dev Next.js pakai **hot reload** — setiap save file, modul di-reload. Tanpa "global cache", tiap hot reload bikin PrismaClient baru → connection pool habis dalam 5 menit.
- `globalForPrisma.prisma = prisma` simpan instance di global object supaya survive hot reload.
- Di production tidak perlu karena tidak ada hot reload.

**Cara pakai (sama dengan Express):**
```ts
import { prisma } from '@/lib/db/client';
const user = await prisma.user.findUnique({ where: { email } });
```

---

## 2. Env validation (`src/lib/env.ts`)

```ts
import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    AUTH_SECRET: z.string().min(32, 'AUTH_SECRET must be at least 32 chars'),
    AUTH_URL: z.string().url(),
  },
  client: {
    NEXT_PUBLIC_DATA_SOURCE: z.enum(['static', 'api']).default('static'),
    NEXT_PUBLIC_API_BASE_URL: z.string().default(''),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_URL: process.env.AUTH_URL,
    NEXT_PUBLIC_DATA_SOURCE: process.env.NEXT_PUBLIC_DATA_SOURCE,
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  },
  skipValidation: process.env.SKIP_ENV_VALIDATION === 'true',
});
```

**Ekuivalen Express:**
```js
// envalid version
const { cleanEnv, str, url } = require('envalid');
const env = cleanEnv(process.env, {
  DATABASE_URL: url(),
  AUTH_SECRET: str({ desc: 'min 32 chars' }),
  AUTH_URL: url(),
});
```

**Kenapa pisah server vs client?**
- `NEXT_PUBLIC_*` vars akan di-inline ke bundle JS yang di-kirim ke browser. JANGAN taruh secret di sini.
- Tanpa prefix `NEXT_PUBLIC_*` → server-only, aman.

**Cara pakai:**
```ts
import { env } from '@/lib/env';
const dbUrl = env.DATABASE_URL;  // type-safe, validated at boot
```

---

## 3. Password helpers (`src/lib/auth/password.ts`)

```ts
import bcrypt from 'bcryptjs';

export const BCRYPT_COST = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}
```

**Ekuivalen Express:** IDENTIK. Tidak ada perbedaan.

**Catatan kontrak:**
- `verifyPassword` **tidak pernah throw**. Selalu return boolean. Ini sengaja — untuk constant-time login (lihat config.ts).

---

## 4. Rate limiter (`src/lib/auth/rate-limit.ts`)

In-memory token bucket. Mirip dengan `express-rate-limit`, tapi ditulis manual.

```ts
export function createRateLimiter(opts: { max: number; windowMs: number }): RateLimiter {
  const buckets = new Map<string, Bucket>();

  return {
    check(key: string): RateLimitResult {
      const now = Date.now();
      const existing = buckets.get(key);
      if (!existing || existing.resetAt <= now) {
        // Bucket baru atau sudah expire — reset
        buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
        return { allowed: true, remaining: opts.max - 1, retryAfterMs: 0 };
      }
      if (existing.count >= opts.max) {
        // Sudah max → blocked
        return { allowed: false, remaining: 0, retryAfterMs: existing.resetAt - now };
      }
      existing.count += 1;
      return { allowed: true, remaining: opts.max - existing.count, retryAfterMs: 0 };
    },
    resetForTests(): void { buckets.clear(); },
  };
}

export const loginRateLimiter = createRateLimiter({ max: 5, windowMs: 15 * 60 * 1000 });
```

**Ekuivalen Express:**
```js
const rateLimit = require('express-rate-limit');
const loginLimiter = rateLimit({ max: 5, windowMs: 15 * 60 * 1000 });
app.post('/login', loginLimiter, loginHandler);
```

**Bedanya:** di Express, rate limiter dipasang sebagai middleware. Di sini, kita panggil `loginRateLimiter.check(ip)` manual di dalam authorize function (lihat config.ts).

---

## 5. requireRole guard (`src/lib/auth/require-role.ts`)

```ts
export { Role } from '@prisma/client';  // re-export enum dari Prisma (ADMIN | EDITOR)

export class UnauthorizedError extends Error { /* 401 */ }
export class ForbiddenError extends Error { /* 403 */ }

export function requireRole(session: AuthSession, allowed: Role[]): AuthSessionUser {
  if (!session?.user) throw new UnauthorizedError();
  if (!allowed.includes(session.user.role)) throw new ForbiddenError();
  return session.user;
}
```

**Ekuivalen Express:**
```js
function requireRole(allowed) {
  return (req, res, next) => {
    if (!req.session?.user) return res.status(401).send('Unauthorized');
    if (!allowed.includes(req.session.user.role)) return res.status(403).send('Forbidden');
    next();
  };
}

app.delete('/api/teachers/:id', requireRole(['ADMIN']), deleteTeacher);
```

**Cara pakai di Phase 2 nanti:**
```ts
// Server Action
'use server';
export async function deleteTeacher(id: string) {
  const session = await auth();
  requireRole(session, ['ADMIN']);  // throws kalau gagal
  await prisma.teacher.delete({ where: { id } });
}
```

---

## 6. Audit log writer (`src/lib/security/audit.ts`)

```ts
export async function writeAudit(input: AuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      target: input.target,
      metadata: input.metadata,
    },
  });
}
```

**Ekuivalen Express:** IDENTIK. Function biasa yang panggil Prisma.

**Pattern penting (akan terlihat di config.ts):**
```ts
await writeAudit({...}).catch(() => {});
```
Audit failure **tidak boleh block login**. Audit DB down ≠ user tidak bisa login. Selalu `.catch(() => {})` saat panggil writeAudit di auth flow.

---

## 7. NextAuth config (`src/lib/auth/config.ts`)

**Ini file yang paling kompleks dan paling penting.** Saya akan jelaskan tiap bagian.

```ts
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { headers as nextHeaders } from 'next/headers';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { verifyPassword, hashPassword } from '@/lib/auth/password';
import { loginRateLimiter } from '@/lib/auth/rate-limit';
import { writeAudit } from '@/lib/security/audit';
import { authConfigEdge } from './config.edge';
```

Standard imports. Catat: `headers` di-rename jadi `nextHeaders` karena ada conflict dengan tipe global `Headers`.

```ts
const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
```

**Zod schema** = body validator. Mirip `express-validator` atau `joi`.

```ts
let _dummyHashPromise: Promise<string> | null = null;
async function getDummyHash(): Promise<string> {
  if (!_dummyHashPromise) {
    _dummyHashPromise = hashPassword(`__dummy_${Math.random()}_${Date.now()}__`);
  }
  return _dummyHashPromise;
}
```

**Dummy hash untuk constant-time login.**

Skenario: attacker ngirim email yang tidak ada. Kalau kita early-return tanpa bcrypt, response cepat (~10ms). Kalau email ADA, kita run bcrypt (~100ms). Attacker bisa deteksi mana user yang exist dari timing.

**Solusinya:** selalu run bcrypt, bahkan untuk user yang tidak exist. Pakai dummy hash. Hasilnya selalu false, tapi durasi sama.

```ts
async function getClientIp(): Promise<string | null> {
  try {
    const h = await nextHeaders();
    return (
      h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      h.get('x-real-ip') ??
      null
    );
  } catch {
    return null;
  }
}
```

**Ekuivalen Express:**
```js
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ??
         req.headers['x-real-ip'] ??
         req.ip;
}
```

Bedanya: di Express, `req` di-pass eksplisit. Di Next.js, ambil dari `headers()` magic function — Next.js handle context dari request scope.

```ts
export const authConfig = {
  ...authConfigEdge,  // merge dengan edge config (callback jwt + session)
  providers: [
    Credentials({
      name: 'credentials',
      credentials: { email: { type: 'email' }, password: { type: 'password' } },
      async authorize(rawCredentials) {
        // ... ini handler-nya, lihat di bawah
      },
    }),
  ],
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
```

`authorize` adalah **login handler**. Mirip dengan Passport `LocalStrategy.verify()`:

```ts
async authorize(rawCredentials) {
  // 1. Validate input
  const parsed = credentialsSchema.safeParse(rawCredentials);
  if (!parsed.success) return null;

  // 2. Rate limit by IP
  const ip = (await getClientIp()) ?? parsed.data.email;
  const rl = loginRateLimiter.check(ip);
  if (!rl.allowed) return null;

  // 3. Find user
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });

  // 4. Verify password (constant time — pakai dummy kalau user tidak ada)
  const hash = user?.passwordHash ?? (await getDummyHash());
  const valid = await verifyPassword(parsed.data.password, hash);

  if (!user || !valid) {
    // Audit failed login (only kalau user beneran ada, supaya tidak enumeration)
    if (user) await writeAudit({ userId: user.id, action: 'login_failed', target: `session:${user.id}` }).catch(() => {});
    return null;  // ← null = login gagal
  }

  // 5. Success — update lastLoginAt + audit
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await writeAudit({ userId: user.id, action: 'login_success', target: `session:${user.id}` }).catch(() => {});

  // 6. Return user object → NextAuth bikin session
  return {
    id: user.id, email: user.email, name: user.name,
    role: user.role, mustChangePassword: user.mustChangePassword,
  };
}
```

**Ekuivalen Express + Passport:**
```js
passport.use(new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
  // Same logic: validate, rate limit, find user, verify, update, return
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return done(null, false);
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return done(null, false);
  return done(null, user);
}));
```

**Yang spesial NextAuth:**
- Return value = user object → otomatis jadi JWT session
- Return null → login gagal (tampilkan error di form)
- Tidak perlu serialize/deserialize manual seperti Passport

---

### Sub-bagian: Edge config

```ts
// src/lib/auth/config.edge.ts
export const authConfigEdge = {
  session: { strategy: 'jwt', maxAge: 7 * 24 * 60 * 60 },  // 7 hari
  pages: { signIn: '/admin/login' },
  providers: [],  // kosong di edge!
  callbacks: {
    async jwt({ token, user }) {
      if (user) {  // first sign-in
        token.id = user.id;
        token.role = user.role;
        token.mustChangePassword = user.mustChangePassword;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.mustChangePassword = token.mustChangePassword;
      return session;
    },
  },
};
```

**Kenapa pisah edge vs config full?**

Middleware (`middleware.ts`) jalan di Edge runtime. Edge tidak bisa import Prisma, bcrypt, dll. Jadi kita pisah:
- `config.edge.ts` — hanya callback JWT + session shape (no Prisma)
- `config.ts` — full config dengan Credentials provider (boleh Prisma)

Middleware import `auth` dari `edge.ts` (yang pakai `config.edge.ts`). Server actions / pages import `auth` dari `config.ts`.

**Pikirannya:** Edge auth cuma cek token di cookie. Tidak perlu Prisma. Token sudah berisi semua info (id, role, mustChangePassword) dari JWT callback.

---

## 8. Middleware (`src/middleware.ts`)

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/lib/auth/edge';            // ← Edge-safe
import { decideMiddlewareAction } from '@/lib/auth/middleware-policy';

export default async function middleware(req: NextRequest) {
  const session = await auth();
  const action = decideMiddlewareAction({
    pathname: req.nextUrl.pathname,
    search: req.nextUrl.search,
    session: session ? { user: { id: session.user.id, role: session.user.role, mustChangePassword: session.user.mustChangePassword } } : null,
  });

  if (action.type === 'redirect') {
    return NextResponse.redirect(new URL(action.to, req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],  // hanya jalan untuk URL admin
};
```

**Ekuivalen Express:**
```js
app.use('/admin/*', async (req, res, next) => {
  const session = req.session;
  if (!session?.user) return res.redirect(`/admin/login?returnUrl=${encodeURIComponent(req.path)}`);
  if (session.user.mustChangePassword && req.path !== '/admin/change-password') {
    return res.redirect('/admin/change-password');
  }
  next();
});
```

**Pattern: pure policy extraction**

`decideMiddlewareAction` adalah **pure function** (no I/O, no DB). Ini supaya logic-nya bisa di-unit-test tanpa harus spin up Next.js:

```ts
// middleware-policy.ts
export function decideMiddlewareAction({ pathname, search, session }):
  | { type: 'next' }
  | { type: 'redirect'; to: string }
{
  if (!pathname.startsWith('/admin')) return { type: 'next' };
  if (pathname === '/admin/login') return { type: 'next' };

  if (!session?.user) {
    const params = new URLSearchParams({ returnUrl: pathname + search });
    return { type: 'redirect', to: `/admin/login?${params.toString()}` };
  }

  if (session.user.mustChangePassword && pathname !== '/admin/change-password') {
    return { type: 'redirect', to: '/admin/change-password' };
  }

  return { type: 'next' };
}
```

**Test-nya:**
```ts
expect(decideMiddlewareAction({ pathname: '/admin/dashboard', search: '', session: null }))
  .toEqual({ type: 'redirect', to: '/admin/login?returnUrl=%2Fadmin%2Fdashboard' });
```

Pattern ini bisa Anda pakai di Express juga — pisah business logic dari framework code, supaya gampang di-test.

---

## 9. Login flow

### Page (`src/app/(admin)/admin/login/page.tsx`)

```tsx
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/config';
import { LoginForm } from './LoginForm';

export const dynamic = 'force-dynamic';  // ← jangan static-render

export default async function LoginPage({ searchParams }) {
  const session = await auth();
  const params = await searchParams;
  const returnUrl = params.returnUrl ?? '/admin/dashboard';

  // Sudah login? Redirect.
  if (session?.user) {
    if (session.user.mustChangePassword) redirect('/admin/change-password');
    redirect(returnUrl);
  }

  // Belum login — render form
  return (
    <main>
      <h1>Masuk Admin</h1>
      <LoginForm returnUrl={returnUrl} />
    </main>
  );
}
```

**Ekuivalen Express:**
```js
app.get('/admin/login', async (req, res) => {
  if (req.session?.user) {
    if (req.session.user.mustChangePassword) return res.redirect('/admin/change-password');
    return res.redirect(req.query.returnUrl ?? '/admin/dashboard');
  }
  res.render('login', { returnUrl: req.query.returnUrl ?? '/admin/dashboard' });
});
```

**Catatan tentang `dynamic = 'force-dynamic'`:**
Tanpa ini, Next.js mungkin static-render halaman (cache HTML-nya). Tapi kita perlu check session per-request, jadi paksa dynamic. Mirip dengan `res.set('Cache-Control', 'no-store')` di Express.

### Form (`LoginForm.tsx`)

```tsx
'use client';  // ← directive, file ini jalan di browser

import { useActionState } from 'react';
import { loginAction } from './actions';

export function LoginForm({ returnUrl }) {
  const [state, formAction, pending] = useActionState(loginAction, null);

  return (
    <form action={formAction}>
      <input type="hidden" name="returnUrl" value={returnUrl} />
      <input name="email" type="email" required />
      <input name="password" type="password" required minLength={8} />
      {state?.error && <p role="alert">{state.error}</p>}
      <button type="submit" disabled={pending}>{pending ? 'Masuk...' : 'Masuk'}</button>
    </form>
  );
}
```

**Ekuivalen di Express + plain HTML:**
```html
<form action="/admin/login" method="POST">
  <input type="hidden" name="returnUrl" value="${returnUrl}">
  <input name="email" type="email" required>
  <input name="password" type="password" required minlength="8">
  <% if (error) { %><p role="alert"><%= error %></p><% } %>
  <button type="submit">Login</button>
</form>
```

**Yang spesial dari `useActionState`:**
- `state` = return value dari action terakhir (kalau action return `{error: '...'}`, state berisi itu)
- `formAction` = function untuk di-set ke `<form action>`
- `pending` = boolean, true selama action lagi jalan (untuk disable button)

Di Express, ini biasanya bikin: submit form → server redirect ke `/admin/login?error=salah` → render form lagi dengan error. Di Next.js, `useActionState` kasih ini "for free" — action return error, form re-render dengan error tanpa redirect.

### Server Action (`actions.ts`)

```ts
'use server';

import { signIn } from '@/lib/auth/config';
import { AuthError } from 'next-auth';

export async function loginAction(_prev, formData) {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const rawReturnUrl = String(formData.get('returnUrl') ?? '/admin/dashboard');
  // Whitelist returnUrl supaya tidak bisa open-redirect ke domain lain
  const returnUrl = rawReturnUrl.startsWith('/admin/') ? rawReturnUrl : '/admin/dashboard';

  try {
    await signIn('credentials', { email, password, redirectTo: returnUrl });
    return null;  // tidak pernah dicapai — signIn throw NEXT_REDIRECT
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: 'Email atau password salah.' };  // ← jadi state di form
    }
    throw err;  // re-throw NEXT_REDIRECT supaya Next.js handle
  }
}
```

**Ekuivalen Express + Passport:**
```js
app.post('/admin/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.render('login', { error: 'Email atau password salah.' });
    req.login(user, (err) => {
      if (err) return next(err);
      const returnUrl = req.body.returnUrl?.startsWith('/admin/') ? req.body.returnUrl : '/admin/dashboard';
      res.redirect(returnUrl);
    });
  })(req, res, next);
});
```

**Yang aneh di Next.js:**
- `signIn` throw `NEXT_REDIRECT` error saat sukses. Ini sengaja — Next.js handle redirect via throwing.
- Di catch, kita check `AuthError` (auth gagal → return state untuk form) atau re-throw (untuk NEXT_REDIRECT).

---

## 10. Change-password flow

### Action (`change-password/actions.ts`)

```ts
'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/client';
import { auth, signOut } from '@/lib/auth/config';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { writeAudit } from '@/lib/security/audit';

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Password baru minimal 8 karakter.'),
  confirmPassword: z.string().min(1),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: 'Konfirmasi password tidak cocok.',
  path: ['confirmPassword'],
});

export async function changePasswordAction(_prev, formData) {
  // 1. Auth check
  const session = await auth();
  if (!session?.user) redirect('/admin/login');

  // 2. Validate input
  const parsed = schema.safeParse({
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
    confirmPassword: formData.get('confirmPassword'),
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Input tidak valid.' };

  // 3. Load user
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect('/admin/login');

  // 4. Verify current password (PENTING: pakai session user ID, bukan dari form)
  const ok = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!ok) return { error: 'Password saat ini salah.' };

  // 5. Update password
  const newHash = await hashPassword(parsed.data.newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: newHash,
      mustChangePassword: false,
      passwordChangedAt: new Date(),
    },
  });

  // 6. Audit
  await writeAudit({ userId: user.id, action: 'password_changed', target: `user:${user.id}` });

  // 7. Sign out (force JWT refresh dengan flag baru)
  await signOut({ redirectTo: '/admin/login?passwordChanged=1' });
  return null;
}
```

**Security insights:**
- User ID diambil dari **session**, bukan dari form. Cegah IDOR.
- Current password di-verify sebelum update. Cegah session hijacking.
- `mustChangePassword: false` di-set server-side. Form tidak bisa kirim ini.
- Setelah update, force logout supaya JWT refresh dengan flag baru.

**Ekuivalen Express:** Sama persis, cuma pakai `req.session.user.id` dan `req.logOut()`.

---

## 11. Dashboard (`src/app/(admin)/admin/dashboard/`)

### Logout action (`actions.ts`)

```ts
'use server';

import { signOut } from '@/lib/auth/config';

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: '/admin/login' });
}
```

**Ekuivalen Express:**
```js
app.post('/admin/logout', (req, res) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect('/admin/login');
  });
});
```

### Page (`page.tsx`)

```tsx
import { auth } from '@/lib/auth/config';
import { logoutAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await auth();
  return (
    <main>
      <h1>Selamat datang, {session?.user.name}</h1>
      <p>Role: {session?.user.role}</p>
      <form action={logoutAction}>
        <button type="submit">Keluar</button>
      </form>
    </main>
  );
}
```

`<form action={logoutAction}>` — form yang nge-trigger Server Action saat di-submit. Tidak ada URL endpoint, Next.js handle semuanya.

---

## 12. Health check (`src/app/api/health/route.ts`)

```ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { status: 'degraded', error: err instanceof Error ? err.message : 'unknown' },
      { status: 503 },
    );
  }
}
```

**Ekuivalen Express:** **persis sama**, hanya beda nama function (`GET` vs `app.get`).

```js
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ok' });
  } catch (err) {
    res.status(503).json({ status: 'degraded', error: err.message });
  }
});
```

---

## Penutup — Cara berpikir saat maintenance

Saat butuh edit code:

1. **Mau bikin halaman baru?** → tambah `page.tsx` di folder yang sesuai
2. **Mau bikin form submit action?** → bikin `actions.ts` di folder yang sama, function dengan `'use server'`
3. **Mau bikin API endpoint REST?** → bikin `app/api/<path>/route.ts`, export `GET`/`POST`/dst
4. **Mau cek session?** → `const session = await auth()` dari `@/lib/auth/config`
5. **Mau protect route?** → tambah logic di `middleware-policy.ts` (pure function, mudah test) atau panggil `requireRole(session, ['ADMIN'])` di dalam Server Action
6. **Mau query DB?** → `import { prisma } from '@/lib/db/client'` lalu pakai seperti biasa

**Saat ragu, lihat code yang sudah ada.** Setiap pattern Phase 0 dirancang untuk di-copy-paste ke Phase 1+ dengan variasi minimal. Misalnya, server action CRUD untuk `Teacher` di Phase 2 akan persis mirip `change-password/actions.ts` — validate, auth check, DB op, audit, return state.

Selamat maintaining! 🚀
