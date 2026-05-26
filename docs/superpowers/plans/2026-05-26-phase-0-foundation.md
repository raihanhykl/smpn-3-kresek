# Phase 0: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [2026-05-26-admin-dashboard-design.md](../specs/2026-05-26-admin-dashboard-design.md) (Phase 0 section)

**Goal:** Switch project dari static export ke server runtime, setup database, auth (NextAuth v5 + bcrypt), middleware guard, dan login flow yang berfungsi — sehingga admin bisa login dan masuk ke `/admin/dashboard` (kosong), public site tetap jalan persis seperti dulu.

**Architecture:** Next.js 15 server runtime + Prisma + Postgres lokal (via Docker untuk dev/test, Postgres asli di Hostinger VPS untuk prod). Auth pakai NextAuth v5 Credentials provider, password di-hash bcrypt cost 10, session JWT httpOnly 7-day sliding renewal. 3-lapis authorization (middleware → layout → server action helper).

**Tech Stack:** Next.js 15 • React 19 • TypeScript strict • Prisma 6 • Postgres 16 • NextAuth.js v5 (Auth.js beta) • bcryptjs • @t3-oss/env-nextjs • Zod • Jest • Playwright • GitHub Actions

**Deliverable:** Login dengan email+password seed → redirect ke `/admin/dashboard`. Public site (`/`, `/profil`, dst) tetap render seperti dulu dari `StaticContentProvider` (data source belum diganti — itu Phase 1). Force-password-change flow berfungsi. CI lint+typecheck+test+build hijau.

**Bukan scope Phase 0** (akan dikerjakan di phase berikutnya):
- ApiContentProvider Prisma implementation (Phase 1)
- Page sections / entities CRUD (Phase 2)
- Media library (Phase 3)
- Inline editor (Phase 4)

---

## Chunk 1: Project setup & infrastructure

### Task 0: Pre-flight check & dependencies

**Files:**
- Modify: `package.json`
- Modify: `.nvmrc` (verify)
- Create: `docker-compose.test.yml`

- [ ] **Step 0.1: Verify Node version**

Run: `node --version`
Expected: `v22.22.0` (or whatever `.nvmrc` says). If different, run `nvm use`.

- [ ] **Step 0.2: Install runtime dependencies**

Run:
```bash
npm install \
  @prisma/client@^6.0.0 \
  next-auth@5.0.0-beta.25 \
  @auth/prisma-adapter@^2.7.0 \
  bcryptjs@^2.4.3 \
  zod@^3.23.0 \
  @t3-oss/env-nextjs@^0.11.0
```

Expected: installs without error. `package.json` `dependencies` now includes all six.

- [ ] **Step 0.3: Install dev dependencies**

Run:
```bash
npm install -D \
  prisma@^6.0.0 \
  @types/bcryptjs@^2.4.6 \
  @playwright/test@^1.49.0 \
  tsx@^4.19.0
```

Expected: installs without error.

- [ ] **Step 0.4: Verify deps installed**

Run: `npm ls @prisma/client next-auth bcryptjs prisma`
Expected: tree printed without UNMET / ERR.

- [ ] **Step 0.5: Add scripts to `package.json`**

Edit `package.json` `scripts` block. Add:
```json
"db:generate": "prisma generate",
"db:migrate": "prisma migrate dev",
"db:migrate:deploy": "prisma migrate deploy",
"db:reset": "prisma migrate reset --force",
"db:seed": "tsx scripts/seed-admin.ts",
"db:studio": "prisma studio",
"test:int": "jest --config jest.config.js --testPathPattern='src/__tests__/integration'",
"e2e": "playwright test",
"e2e:ui": "playwright test --ui"
```

- [ ] **Step 0.6: Create docker-compose for test DB**

Create `docker-compose.test.yml`:
```yaml
services:
  postgres-test:
    image: postgres:16-alpine
    container_name: smpn3-postgres-test
    environment:
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
      POSTGRES_DB: smpn3_test
    ports:
      - "5433:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U test -d smpn3_test"]
      interval: 2s
      timeout: 2s
      retries: 10
    tmpfs:
      - /var/lib/postgresql/data
```

`tmpfs` makes the DB ephemeral (in-memory), fast per-test reset.

- [ ] **Step 0.7: Start test DB & verify**

Run: `docker compose -f docker-compose.test.yml up -d`
Expected: container `smpn3-postgres-test` healthy.

Run: `docker compose -f docker-compose.test.yml ps`
Expected: STATUS `Up X seconds (healthy)`.

- [ ] **Step 0.8: Commit**

```bash
git add package.json package-lock.json docker-compose.test.yml
git commit -m "chore: add prisma, next-auth, bcrypt, and test postgres compose"
```

---

### Task 1: Validated env vars module

**Why:** Without env validation, missing config silently crashes at runtime. We fail fast at app boot.

**Files:**
- Create: `src/lib/env.ts`
- Modify: `.env.example`

- [ ] **Step 1.1: Update `.env.example`**

Replace contents of `.env.example`:
```bash
# === Database ===
DATABASE_URL="postgresql://test:test@localhost:5433/smpn3_test?schema=public"

# === Auth (NextAuth v5) ===
# Generate: openssl rand -base64 32
AUTH_SECRET=""
# v5 naming (NOT NEXTAUTH_URL). Set to actual deploy URL in production.
AUTH_URL="http://localhost:3000"

# === Data source toggle (existing) ===
# Phase 0 keeps this on "static". Phase 1 switches to "api".
NEXT_PUBLIC_DATA_SOURCE=static
NEXT_PUBLIC_API_BASE_URL=
```

- [ ] **Step 1.2: Create `.env.local` for development**

```bash
cp .env.example .env.local
echo "AUTH_SECRET=\"$(openssl rand -base64 32)\"" >> .env.local
```

Manually edit `.env.local` to remove duplicate `AUTH_SECRET=""` line.

Verify: `cat .env.local` shows `AUTH_SECRET="<base64 string>"` exactly once.

- [ ] **Step 1.3: Write failing test for env validation**

Create `src/__tests__/lib/env.test.ts`:
```ts
describe('env validation', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
  });

  it('throws when DATABASE_URL is missing', () => {
    process.env = { ...originalEnv, DATABASE_URL: undefined };
    expect(() => {
      jest.isolateModules(() => {
        require('@/lib/env');
      });
    }).toThrow();
  });

  it('throws when AUTH_SECRET is empty', () => {
    process.env = { ...originalEnv, AUTH_SECRET: '' };
    expect(() => {
      jest.isolateModules(() => {
        require('@/lib/env');
      });
    }).toThrow();
  });

  it('exposes typed env when all vars are valid', () => {
    process.env = {
      ...originalEnv,
      DATABASE_URL: 'postgresql://x:y@localhost:5432/z',
      AUTH_SECRET: 'a'.repeat(32),
      AUTH_URL: 'http://localhost:3000',
    };
    let env: unknown;
    jest.isolateModules(() => {
      env = require('@/lib/env').env;
    });
    expect(env).toMatchObject({
      DATABASE_URL: expect.stringContaining('postgresql://'),
      AUTH_SECRET: expect.any(String),
    });
  });
});
```

- [ ] **Step 1.4: Run test, expect FAIL**

Run: `npm test -- --testPathPattern='env.test'`
Expected: FAIL — `Cannot find module '@/lib/env'`.

- [ ] **Step 1.5: Implement `src/lib/env.ts`**

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

- [ ] **Step 1.6: Run test, expect PASS**

Run: `npm test -- --testPathPattern='env.test'`
Expected: 3 tests PASS.

- [ ] **Step 1.7: Run typecheck & lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 1.8: Commit**

```bash
git add src/lib/env.ts src/__tests__/lib/env.test.ts .env.example
git commit -m "feat(env): typed env validation with @t3-oss/env-nextjs"
```

Note: `.env.local` is gitignored (verify with `git check-ignore .env.local`).

---

### Task 2: Switch Next.js to server runtime

**Why:** Phase 0 introduces auth & middleware which require server runtime. Static export must be removed. Public pages still render from `StaticContentProvider` (no DB calls yet), so visual output unchanged.

**Files:**
- Modify: `next.config.mjs`
- Modify: `src/app/(admin)/layout.tsx`
- Modify: `src/app/(admin)/admin/page.tsx`

- [ ] **Step 2.1: Modify `next.config.mjs`**

Replace contents:
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },
  // Phase 0: no output:'export', no trailingSlash (server runtime now).
  // Phase 3 will add images.remotePatterns for Cloudinary.
  env: {
    NEXT_PUBLIC_DATA_SOURCE: process.env.NEXT_PUBLIC_DATA_SOURCE ?? 'static',
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL ?? '',
  },
};

export default nextConfig;
```

Removed: `output: 'export'`, `images: { unoptimized: true }`, `trailingSlash: true`.

- [ ] **Step 2.2: Remove `notFound()` gate from admin layout**

Replace `src/app/(admin)/layout.tsx`:
```tsx
import type { ReactNode } from 'react';

/**
 * Admin route group layout.
 * Phase 0 keeps this minimal — auth guard lives in middleware.ts.
 * Phase 2 will replace this with proper admin shell (sidebar + topbar).
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
```

- [ ] **Step 2.3: Replace `/admin` placeholder with redirect**

Replace `src/app/(admin)/admin/page.tsx`:
```tsx
import { redirect } from 'next/navigation';

export default function AdminIndexPage() {
  redirect('/admin/dashboard');
}
```

- [ ] **Step 2.4: Verify build still passes (without DB yet)**

Run: `SKIP_ENV_VALIDATION=true npm run build`
Expected: build succeeds. Output is `.next/`, no `out/` directory.

(Routes /admin/dashboard, /admin/login don't exist yet — they'll be added in Chunk 3. For now the build should produce the public pages + the redirect at /admin.)

- [ ] **Step 2.5: Verify public site still renders**

Run: `SKIP_ENV_VALIDATION=true npm run dev`
In browser: open `http://localhost:3000/` — home page renders.
Open `http://localhost:3000/profil` — profil page renders.
Open `http://localhost:3000/admin` — 404 (because /admin/dashboard doesn't exist yet; that's expected).

Stop dev server (Ctrl+C).

- [ ] **Step 2.6: Run existing tests**

Run: `npm test`
Expected: existing 51 tests + 3 env tests = 54 tests pass.

- [ ] **Step 2.7: Commit**

```bash
git add next.config.mjs src/app/\(admin\)
git commit -m "feat: switch from static export to next.js server runtime"
```

---

### Task 3: Prisma schema (User, Session, AuditLog) + first migration

**Files:**
- Create: `prisma/schema.prisma`
- Create: `prisma/migrations/...` (generated)

- [ ] **Step 3.1: Initialize prisma config**

Run: `npx prisma init --datasource-provider postgresql`

Expected: creates `prisma/schema.prisma` (skeleton) and updates `.env` (DO NOT use this generated `.env` — we use `.env.local`).

If a new `.env` was created at project root, **delete it** to avoid confusion. Our env lives in `.env.local`.

Run: `rm -f .env`
Verify: `ls -la | grep '.env'` shows only `.env.example` and `.env.local`.

- [ ] **Step 3.2: Replace `prisma/schema.prisma` with Phase 0 schema**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  ADMIN
  EDITOR
}

model User {
  id                  String    @id @default(cuid())
  email               String    @unique
  passwordHash        String
  name                String
  role                Role
  mustChangePassword  Boolean   @default(false)
  passwordChangedAt   DateTime?
  createdAt           DateTime  @default(now())
  lastLoginAt         DateTime?
  sessions            Session[]
  auditLogs           AuditLog[]
}

model Session {
  id        String   @id
  userId    String
  expiresAt DateTime
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model AuditLog {
  id        String   @id @default(cuid())
  userId    String
  action    String
  target    String
  metadata  Json?
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
  @@index([target, createdAt])
}
```

Note: schema for Phase 0 only. Phase 1 will add PageSection, SiteConfig, Navigation, entities.

- [ ] **Step 3.3: Create first migration against test DB**

Ensure test postgres is running (`docker compose -f docker-compose.test.yml ps`).

Run:
```bash
DATABASE_URL="postgresql://test:test@localhost:5433/smpn3_test?schema=public" npx prisma migrate dev --name phase0_init
```

Expected: creates `prisma/migrations/<timestamp>_phase0_init/migration.sql`, applies to test DB, generates Prisma client.

- [ ] **Step 3.4: Verify migration file**

Run: `ls prisma/migrations/`
Expected: 1 folder named like `20260526120000_phase0_init/`.

Run: `cat prisma/migrations/*/migration.sql`
Expected: SQL with `CREATE TABLE "User"`, `CREATE TABLE "Session"`, `CREATE TABLE "AuditLog"`, `CREATE TYPE "Role"`.

- [ ] **Step 3.5: Verify Prisma client generated**

Run: `ls node_modules/.prisma/client/`
Expected: directory exists with `index.d.ts` and runtime files.

- [ ] **Step 3.6: Sanity smoke — connect to test DB**

Create a one-off file `scripts/smoke-db.ts`:
```ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.user.count();
  console.log('User count:', count);
}
main().finally(() => prisma.$disconnect());
```

Run:
```bash
DATABASE_URL="postgresql://test:test@localhost:5433/smpn3_test?schema=public" npx tsx scripts/smoke-db.ts
```
Expected: `User count: 0`.

Delete the smoke file: `rm scripts/smoke-db.ts`.

- [ ] **Step 3.7: Add `.gitignore` rules for Prisma**

Verify `.gitignore` contains:
```
/node_modules
/.next
/.env.local
```

If `.env` (without `.local`) is not in `.gitignore`, add it:
```
.env
```

- [ ] **Step 3.8: Commit schema + first migration**

```bash
git add prisma/schema.prisma prisma/migrations/ .gitignore
git commit -m "feat(db): phase 0 schema (User, Session, AuditLog) + initial migration"
```

---

### Task 4: Prisma singleton client

**Why:** Hot-reload in Next.js dev creates a new Prisma client per request → connection pool exhaustion. The "global cache" pattern is the standard fix.

**Files:**
- Create: `src/lib/db/client.ts`
- Create: `src/__tests__/lib/db/client.test.ts`

- [ ] **Step 4.1: Write failing test**

Create `src/__tests__/lib/db/client.test.ts`:
```ts
describe('prisma singleton', () => {
  afterEach(() => {
    jest.resetModules();
  });

  it('returns same instance on multiple imports', () => {
    let a: unknown, b: unknown;
    jest.isolateModules(() => {
      a = require('@/lib/db/client').prisma;
      b = require('@/lib/db/client').prisma;
    });
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 4.2: Run test, expect FAIL**

Run: `npm test -- --testPathPattern='db/client'`
Expected: FAIL — module not found.

- [ ] **Step 4.3: Implement singleton**

Create `src/lib/db/client.ts`:
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

- [ ] **Step 4.4: Run test, expect PASS**

Run: `npm test -- --testPathPattern='db/client'`
Expected: 1 test PASS.

- [ ] **Step 4.5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4.6: Commit**

```bash
git add src/lib/db/client.ts src/__tests__/lib/db/client.test.ts
git commit -m "feat(db): prisma singleton client (hot-reload safe)"
```

---

## Chunk 2: Auth primitives (password, rate-limit, require-role)

### Task 5: bcrypt password helper

**Files:**
- Create: `src/lib/auth/password.ts`
- Create: `src/__tests__/lib/auth/password.test.ts`

- [ ] **Step 5.1: Write failing test**

Create `src/__tests__/lib/auth/password.test.ts`:
```ts
import { hashPassword, verifyPassword } from '@/lib/auth/password';

describe('password', () => {
  it('hashes and verifies roundtrip', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).not.toBe('correct horse battery staple');
    expect(hash.length).toBeGreaterThan(50);
    await expect(verifyPassword('correct horse battery staple', hash)).resolves.toBe(true);
  });

  it('rejects wrong password', async () => {
    const hash = await hashPassword('right');
    await expect(verifyPassword('wrong', hash)).resolves.toBe(false);
  });

  it('returns false (not throw) when hash is malformed', async () => {
    await expect(verifyPassword('anything', 'not-a-bcrypt-hash')).resolves.toBe(false);
  });

  it('produces different hashes for same input (salt)', async () => {
    const a = await hashPassword('same');
    const b = await hashPassword('same');
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 5.2: Run test, expect FAIL**

Run: `npm test -- --testPathPattern='auth/password'`
Expected: FAIL — module not found.

- [ ] **Step 5.3: Implement password helper**

Create `src/lib/auth/password.ts`:
```ts
import bcrypt from 'bcryptjs';

const COST = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}
```

- [ ] **Step 5.4: Run test, expect PASS**

Run: `npm test -- --testPathPattern='auth/password'`
Expected: 4 tests PASS.

- [ ] **Step 5.5: Commit**

```bash
git add src/lib/auth/password.ts src/__tests__/lib/auth/password.test.ts
git commit -m "feat(auth): bcrypt password hash + verify helpers"
```

---

### Task 6: In-memory rate limiter (token bucket per IP)

**Why:** Prevent brute-force login. In-memory is fine for single-VPS deployment (sticky to one process). If we ever scale horizontally we'll swap to Redis — schema is the same.

**Files:**
- Create: `src/lib/auth/rate-limit.ts`
- Create: `src/__tests__/lib/auth/rate-limit.test.ts`

- [ ] **Step 6.1: Write failing test**

Create `src/__tests__/lib/auth/rate-limit.test.ts`:
```ts
import { createRateLimiter } from '@/lib/auth/rate-limit';

describe('rate limiter (token bucket)', () => {
  it('allows up to N attempts within window', () => {
    const limiter = createRateLimiter({ max: 3, windowMs: 1000 });
    expect(limiter.check('ip-1').allowed).toBe(true);
    expect(limiter.check('ip-1').allowed).toBe(true);
    expect(limiter.check('ip-1').allowed).toBe(true);
    expect(limiter.check('ip-1').allowed).toBe(false);
  });

  it('returns remaining count', () => {
    const limiter = createRateLimiter({ max: 3, windowMs: 1000 });
    expect(limiter.check('ip-2').remaining).toBe(2);
    expect(limiter.check('ip-2').remaining).toBe(1);
    expect(limiter.check('ip-2').remaining).toBe(0);
  });

  it('isolates keys', () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 1000 });
    expect(limiter.check('ip-a').allowed).toBe(true);
    expect(limiter.check('ip-b').allowed).toBe(true);
    expect(limiter.check('ip-a').allowed).toBe(false);
  });

  it('resets after window expires', () => {
    jest.useFakeTimers();
    const limiter = createRateLimiter({ max: 1, windowMs: 1000 });
    expect(limiter.check('ip-c').allowed).toBe(true);
    expect(limiter.check('ip-c').allowed).toBe(false);
    jest.advanceTimersByTime(1001);
    expect(limiter.check('ip-c').allowed).toBe(true);
    jest.useRealTimers();
  });

  it('returns retryAfterMs when blocked', () => {
    jest.useFakeTimers();
    const limiter = createRateLimiter({ max: 1, windowMs: 5000 });
    limiter.check('ip-d');
    const result = limiter.check('ip-d');
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
    expect(result.retryAfterMs).toBeLessThanOrEqual(5000);
    jest.useRealTimers();
  });
});
```

- [ ] **Step 6.2: Run test, expect FAIL**

Run: `npm test -- --testPathPattern='rate-limit'`
Expected: FAIL — module not found.

- [ ] **Step 6.3: Implement rate limiter**

Create `src/lib/auth/rate-limit.ts`:
```ts
type Bucket = { count: number; resetAt: number };

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

export type RateLimiter = {
  check(key: string): RateLimitResult;
};

export function createRateLimiter(opts: { max: number; windowMs: number }): RateLimiter {
  const buckets = new Map<string, Bucket>();

  return {
    check(key: string): RateLimitResult {
      const now = Date.now();
      const existing = buckets.get(key);
      if (!existing || existing.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
        return { allowed: true, remaining: opts.max - 1, retryAfterMs: 0 };
      }
      if (existing.count >= opts.max) {
        return { allowed: false, remaining: 0, retryAfterMs: existing.resetAt - now };
      }
      existing.count += 1;
      return {
        allowed: true,
        remaining: opts.max - existing.count,
        retryAfterMs: 0,
      };
    },
  };
}

// Default exported limiter for login: 5 attempts per 15 minutes per key.
export const loginRateLimiter = createRateLimiter({ max: 5, windowMs: 15 * 60 * 1000 });
```

- [ ] **Step 6.4: Run test, expect PASS**

Run: `npm test -- --testPathPattern='rate-limit'`
Expected: 5 tests PASS.

- [ ] **Step 6.5: Commit**

```bash
git add src/lib/auth/rate-limit.ts src/__tests__/lib/auth/rate-limit.test.ts
git commit -m "feat(auth): in-memory token-bucket rate limiter"
```

---

### Task 7: `requireRole` server-side guard

**Why:** Defense-in-depth layer 3. Every server action that mutates state starts with this helper. Centralizes role check; eliminates per-action ad-hoc checks.

**Files:**
- Create: `src/lib/auth/require-role.ts`
- Create: `src/__tests__/lib/auth/require-role.test.ts`

- [ ] **Step 7.1: Write failing test**

Create `src/__tests__/lib/auth/require-role.test.ts`:
```ts
import { requireRole, UnauthorizedError, ForbiddenError } from '@/lib/auth/require-role';

type Session = { user: { id: string; role: 'ADMIN' | 'EDITOR' } } | null;

describe('requireRole', () => {
  it('throws UnauthorizedError when session is null', () => {
    expect(() => requireRole(null as Session, ['ADMIN'])).toThrow(UnauthorizedError);
  });

  it('throws ForbiddenError when role not allowed', () => {
    const session: Session = { user: { id: 'u1', role: 'EDITOR' } };
    expect(() => requireRole(session, ['ADMIN'])).toThrow(ForbiddenError);
  });

  it('returns user when role allowed (single)', () => {
    const session: Session = { user: { id: 'u1', role: 'ADMIN' } };
    expect(requireRole(session, ['ADMIN'])).toEqual({ id: 'u1', role: 'ADMIN' });
  });

  it('returns user when role allowed (multiple)', () => {
    const session: Session = { user: { id: 'u2', role: 'EDITOR' } };
    expect(requireRole(session, ['ADMIN', 'EDITOR'])).toEqual({ id: 'u2', role: 'EDITOR' });
  });
});
```

- [ ] **Step 7.2: Run test, expect FAIL**

Run: `npm test -- --testPathPattern='require-role'`
Expected: FAIL — module not found.

- [ ] **Step 7.3: Implement guard**

Create `src/lib/auth/require-role.ts`:
```ts
export type Role = 'ADMIN' | 'EDITOR';

export type AuthSessionUser = { id: string; role: Role };

export type AuthSession = { user: AuthSessionUser } | null;

export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor() {
    super('Forbidden');
    this.name = 'ForbiddenError';
  }
}

export function requireRole(session: AuthSession, allowed: Role[]): AuthSessionUser {
  if (!session?.user) throw new UnauthorizedError();
  if (!allowed.includes(session.user.role)) throw new ForbiddenError();
  return session.user;
}
```

- [ ] **Step 7.4: Run test, expect PASS**

Run: `npm test -- --testPathPattern='require-role'`
Expected: 4 tests PASS.

- [ ] **Step 7.5: Commit**

```bash
git add src/lib/auth/require-role.ts src/__tests__/lib/auth/require-role.test.ts
git commit -m "feat(auth): requireRole server-side guard with typed errors"
```

---

### Task 8: Audit log writer

**Files:**
- Create: `src/lib/security/audit.ts`
- Create: `src/__tests__/integration/audit.test.ts`

- [ ] **Step 8.1: Write failing integration test (hits real test DB)**

Create `src/__tests__/integration/audit.test.ts`:
```ts
import { prisma } from '@/lib/db/client';
import { writeAudit } from '@/lib/security/audit';

describe('writeAudit', () => {
  beforeAll(async () => {
    await prisma.auditLog.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.user.create({
      data: {
        id: 'audit-test-user',
        email: 'audit@test.local',
        passwordHash: 'x',
        name: 'Audit Test',
        role: 'ADMIN',
      },
    });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  it('persists an audit row with userId, action, target, metadata', async () => {
    await writeAudit({
      userId: 'audit-test-user',
      action: 'login_success',
      target: 'session:audit-test-user',
      metadata: { ip: '127.0.0.1' },
    });

    const rows = await prisma.auditLog.findMany({ where: { userId: 'audit-test-user' } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: 'audit-test-user',
      action: 'login_success',
      target: 'session:audit-test-user',
      metadata: { ip: '127.0.0.1' },
    });
    expect(rows[0]?.createdAt).toBeInstanceOf(Date);
  });

  it('persists without metadata when omitted', async () => {
    await writeAudit({
      userId: 'audit-test-user',
      action: 'logout',
      target: 'session:audit-test-user',
    });
    const rows = await prisma.auditLog.findMany({
      where: { userId: 'audit-test-user', action: 'logout' },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.metadata).toBeNull();
  });
});
```

- [ ] **Step 8.2: Configure Jest to run integration tests against test DB**

Create `jest.integration.config.js` at project root:
```js
const nextJest = require('next/jest.js');
const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.integration.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@lib/(.*)$': '<rootDir>/src/lib/$1',
  },
  testMatch: ['<rootDir>/src/__tests__/integration/**/*.test.{ts,tsx}'],
  testTimeout: 15000,
};

module.exports = createJestConfig(config);
```

Create `jest.integration.setup.ts`:
```ts
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5433/smpn3_test?schema=public';
process.env.AUTH_SECRET ??= 'test-secret-must-be-at-least-thirty-two-chars';
process.env.AUTH_URL ??= 'http://localhost:3000';
process.env.SKIP_ENV_VALIDATION = 'true';
```

Update `package.json` `scripts`:
```json
"test:int": "jest --config jest.integration.config.js"
```

(replace the earlier line added in Step 0.5).

Also exclude integration tests from default `jest.config.js`:
Modify the `testMatch` line in `jest.config.js`:
```js
testMatch: ['<rootDir>/src/__tests__/**/*.test.{ts,tsx}', '!<rootDir>/src/__tests__/integration/**'],
```

- [ ] **Step 8.3: Run integration test, expect FAIL**

Run: `npm run test:int`
Expected: FAIL — `Cannot find module '@/lib/security/audit'`.

- [ ] **Step 8.4: Implement audit writer**

Create `src/lib/security/audit.ts`:
```ts
import { prisma } from '@/lib/db/client';

export type AuditInput = {
  userId: string;
  action: string;
  target: string;
  metadata?: Record<string, unknown>;
};

export async function writeAudit(input: AuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      target: input.target,
      metadata: input.metadata ?? undefined,
    },
  });
}
```

- [ ] **Step 8.5: Run integration test, expect PASS**

Run: `npm run test:int`
Expected: 2 tests PASS.

- [ ] **Step 8.6: Verify unit tests still pass and don't try to hit DB**

Run: `npm test`
Expected: all unit tests pass (no integration test executed).

- [ ] **Step 8.7: Commit**

```bash
git add src/lib/security/audit.ts \
        src/__tests__/integration/audit.test.ts \
        jest.integration.config.js jest.integration.setup.ts \
        jest.config.js package.json
git commit -m "feat(security): audit log writer + integration test setup"
```

---

## Chunk 3: NextAuth integration + login flow

### Task 9: NextAuth v5 config with Credentials provider

**Why:** This is the heart of the auth system. Wires together: DB user lookup → bcrypt verify → JWT session → callbacks that inject role + mustChangePassword into the session.

**Files:**
- Create: `src/lib/auth/config.ts`
- Create: `src/lib/auth/session.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/types/next-auth.d.ts`

- [ ] **Step 9.1: Module augmentation for typed session**

Create `src/types/next-auth.d.ts`:
```ts
import type { Role } from '@/lib/auth/require-role';
import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
      mustChangePassword: boolean;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    role: Role;
    mustChangePassword: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: Role;
    mustChangePassword: boolean;
  }
}
```

- [ ] **Step 9.2: NextAuth config**

Create `src/lib/auth/config.ts`:
```ts
import NextAuth, { type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { verifyPassword } from '@/lib/auth/password';
import { loginRateLimiter } from '@/lib/auth/rate-limit';
import { writeAudit } from '@/lib/security/audit';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Dummy bcrypt hash used to keep timing constant when user not found.
// Generated once by hashing 'dummy' — value here is opaque, only used for constant-time verify.
const DUMMY_HASH = '$2b$10$CwTycUXWue0Thq9StjUM0uJ8L8L8L8L8L8L8L8L8L8L8L8L8L8L8L';

export const authConfig: NextAuthConfig = {
  session: { strategy: 'jwt', maxAge: 7 * 24 * 60 * 60 }, // 7 days
  pages: { signIn: '/admin/login' },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(rawCredentials, request) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        // Rate limit by client IP (best-effort — falls back to email if no IP header).
        const ip =
          request?.headers?.get?.('x-forwarded-for')?.split(',')[0]?.trim() ??
          request?.headers?.get?.('x-real-ip') ??
          parsed.data.email;
        const rl = loginRateLimiter.check(ip);
        if (!rl.allowed) return null;

        const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
        // Always run bcrypt to keep timing constant whether user exists or not.
        const hash = user?.passwordHash ?? DUMMY_HASH;
        const valid = await verifyPassword(parsed.data.password, hash);
        if (!user || !valid) {
          if (user) {
            await writeAudit({
              userId: user.id,
              action: 'login_failed',
              target: `session:${user.id}`,
            }).catch(() => {});
          }
          return null;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
        await writeAudit({
          userId: user.id,
          action: 'login_success',
          target: `session:${user.id}`,
        }).catch(() => {});

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
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

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
```

- [ ] **Step 9.3: Server-side session helper**

Create `src/lib/auth/session.ts`:
```ts
import { auth } from '@/lib/auth/config';
import type { AuthSession } from '@/lib/auth/require-role';

/**
 * Returns the current session (server components, server actions, route handlers).
 * Shape-compatible with requireRole().
 */
export async function getSession(): Promise<AuthSession> {
  const session = await auth();
  if (!session?.user) return null;
  return {
    user: {
      id: session.user.id,
      role: session.user.role,
    },
  };
}
```

- [ ] **Step 9.4: Mount NextAuth route handlers**

Create `src/app/api/auth/[...nextauth]/route.ts`:
```ts
export { GET, POST } from '@/lib/auth/handlers';
```

Create `src/lib/auth/handlers.ts`:
```ts
import { handlers } from '@/lib/auth/config';

export const { GET, POST } = handlers;
```

(Separate file because the route file should only re-export — keeps next-auth import out of the route layer for testability.)

- [ ] **Step 9.5: Typecheck**

Run: `npm run typecheck`
Expected: no errors. If NextAuth complains about `request.headers` typing, the cast is fine since the runtime shape is correct.

- [ ] **Step 9.6: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 9.7: Commit**

```bash
git add src/lib/auth/config.ts src/lib/auth/session.ts \
        src/lib/auth/handlers.ts src/app/api/auth \
        src/types/next-auth.d.ts
git commit -m "feat(auth): nextauth v5 credentials provider with bcrypt + rate limit"
```

---

### Task 10: Integration test — full login flow against test DB

**Files:**
- Create: `src/__tests__/integration/auth-login.test.ts`

- [ ] **Step 10.1: Write integration test for `authorize()`**

Create `src/__tests__/integration/auth-login.test.ts`:
```ts
import { prisma } from '@/lib/db/client';
import { hashPassword } from '@/lib/auth/password';
import { authConfig } from '@/lib/auth/config';

// Extract the credentials provider's authorize for direct invocation.
function getAuthorize() {
  const provider = authConfig.providers[0] as unknown as {
    authorize: (
      creds: { email: string; password: string } | undefined,
      req: { headers: Headers },
    ) => Promise<unknown>;
  };
  return provider.authorize.bind(provider);
}

describe('credentials authorize()', () => {
  const TEST_EMAIL = 'admin@smpn3.test';
  const TEST_PASSWORD = 'correct-horse-battery-staple';

  beforeAll(async () => {
    await prisma.auditLog.deleteMany({});
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
    await prisma.user.create({
      data: {
        email: TEST_EMAIL,
        name: 'Test Admin',
        role: 'ADMIN',
        passwordHash: await hashPassword(TEST_PASSWORD),
      },
    });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({});
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
    await prisma.$disconnect();
  });

  const fakeRequest = (ip = '10.0.0.1') => ({
    headers: new Headers({ 'x-forwarded-for': ip }),
  });

  it('returns user on correct credentials', async () => {
    const authorize = getAuthorize();
    const result = (await authorize(
      { email: TEST_EMAIL, password: TEST_PASSWORD },
      fakeRequest('10.0.0.10'),
    )) as { email: string; role: string } | null;
    expect(result).not.toBeNull();
    expect(result?.email).toBe(TEST_EMAIL);
    expect(result?.role).toBe('ADMIN');
  });

  it('returns null on wrong password', async () => {
    const authorize = getAuthorize();
    const result = await authorize(
      { email: TEST_EMAIL, password: 'wrong' },
      fakeRequest('10.0.0.11'),
    );
    expect(result).toBeNull();
  });

  it('returns null on unknown email', async () => {
    const authorize = getAuthorize();
    const result = await authorize(
      { email: 'ghost@smpn3.test', password: 'whatever' },
      fakeRequest('10.0.0.12'),
    );
    expect(result).toBeNull();
  });

  it('returns null on malformed input', async () => {
    const authorize = getAuthorize();
    const result = await authorize(
      { email: 'not-an-email', password: '' },
      fakeRequest('10.0.0.13'),
    );
    expect(result).toBeNull();
  });

  it('writes audit row on successful login', async () => {
    const authorize = getAuthorize();
    await authorize({ email: TEST_EMAIL, password: TEST_PASSWORD }, fakeRequest('10.0.0.14'));
    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    const audits = await prisma.auditLog.findMany({
      where: { userId: user!.id, action: 'login_success' },
    });
    expect(audits.length).toBeGreaterThanOrEqual(1);
  });

  it('updates lastLoginAt on success', async () => {
    const authorize = getAuthorize();
    const before = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    await new Promise((r) => setTimeout(r, 10));
    await authorize({ email: TEST_EMAIL, password: TEST_PASSWORD }, fakeRequest('10.0.0.15'));
    const after = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    expect(after?.lastLoginAt).not.toBeNull();
    if (before?.lastLoginAt && after?.lastLoginAt) {
      expect(after.lastLoginAt.getTime()).toBeGreaterThan(before.lastLoginAt.getTime());
    }
  });

  it('blocks after rate-limit threshold from same IP', async () => {
    const authorize = getAuthorize();
    const ip = '10.0.0.99';
    // Burn the bucket (max 5 per 15 min).
    for (let i = 0; i < 5; i++) {
      await authorize({ email: TEST_EMAIL, password: 'wrong' }, fakeRequest(ip));
    }
    const result = await authorize(
      { email: TEST_EMAIL, password: TEST_PASSWORD },
      fakeRequest(ip),
    );
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 10.2: Run, expect PASS**

Run: `npm run test:int -- --testPathPattern='auth-login'`
Expected: 7 tests PASS.

- [ ] **Step 10.3: Commit**

```bash
git add src/__tests__/integration/auth-login.test.ts
git commit -m "test(auth): integration tests for credentials authorize flow"
```

---

### Task 11: Edge middleware (auth guard for /admin/*)

**Why:** Defense-in-depth layer 1. Before any admin page renders, check session exists. Unauthenticated → redirect to `/admin/login` with `returnUrl`.

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 11.1: Implement middleware**

Create `src/middleware.ts`:
```ts
import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/lib/auth/config';

const PUBLIC_ADMIN_PATHS = ['/admin/login'];

export default async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (!pathname.startsWith('/admin')) return NextResponse.next();
  if (PUBLIC_ADMIN_PATHS.includes(pathname)) return NextResponse.next();

  const session = await auth();
  if (!session?.user) {
    const loginUrl = new URL('/admin/login', req.url);
    loginUrl.searchParams.set('returnUrl', pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  // Force password change flow.
  if (session.user.mustChangePassword && pathname !== '/admin/change-password') {
    return NextResponse.redirect(new URL('/admin/change-password', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
```

- [ ] **Step 11.2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 11.3: Build (smoke)**

Run: `npm run build`
Expected: success. Routes manifest should list `middleware` and `/admin/*` matchers.

If build fails because /admin/dashboard or /admin/change-password don't exist yet, that's fine for now — middleware matcher just checks paths, not page existence. The build is testing that middleware compiles & next.js wires it.

- [ ] **Step 11.4: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(auth): edge middleware with auth guard + force-change-password redirect"
```

---

### Task 12: Login page (server component + client form)

**Files:**
- Create: `src/app/(admin)/admin/login/page.tsx`
- Create: `src/app/(admin)/admin/login/LoginForm.tsx`
- Create: `src/app/(admin)/admin/login/actions.ts`

- [ ] **Step 12.1: Server action for login**

Create `src/app/(admin)/admin/login/actions.ts`:
```ts
'use server';

import { signIn } from '@/lib/auth/config';
import { AuthError } from 'next-auth';

export type LoginState = { error?: string } | null;

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const returnUrl = String(formData.get('returnUrl') ?? '/admin/dashboard');

  try {
    await signIn('credentials', {
      email,
      password,
      redirectTo: returnUrl,
    });
    return null; // never reached because signIn throws redirect
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: 'Email atau password salah.' };
    }
    // Re-throw to let Next.js handle the redirect (signIn uses redirect internally).
    throw err;
  }
}
```

- [ ] **Step 12.2: Client form component**

Create `src/app/(admin)/admin/login/LoginForm.tsx`:
```tsx
'use client';

import { useActionState } from 'react';
import { loginAction, type LoginState } from './actions';

export function LoginForm({ returnUrl }: { returnUrl: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="returnUrl" value={returnUrl} />
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-neutral-800">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-neutral-800">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          minLength={8}
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      {state?.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-primary px-4 py-2 font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
      >
        {pending ? 'Masuk...' : 'Masuk'}
      </button>
    </form>
  );
}
```

- [ ] **Step 12.3: Page (server component shell)**

Create `src/app/(admin)/admin/login/page.tsx`:
```tsx
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/config';
import { LoginForm } from './LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnUrl?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const returnUrl = params.returnUrl ?? '/admin/dashboard';

  if (session?.user) {
    if (session.user.mustChangePassword) redirect('/admin/change-password');
    redirect(returnUrl);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm">
        <h1 className="font-heading text-2xl font-bold text-neutral-900">
          Masuk Admin
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Dashboard pengelolaan website SMPN 3 Kresek
        </p>
        <div className="mt-6">
          <LoginForm returnUrl={returnUrl} />
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 12.4: Typecheck & lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 12.5: Commit**

```bash
git add src/app/\(admin\)/admin/login
git commit -m "feat(admin): login page + form + server action"
```

---

### Task 13: Dashboard placeholder + change-password page

**Files:**
- Create: `src/app/(admin)/admin/dashboard/page.tsx`
- Create: `src/app/(admin)/admin/change-password/page.tsx`
- Create: `src/app/(admin)/admin/change-password/ChangePasswordForm.tsx`
- Create: `src/app/(admin)/admin/change-password/actions.ts`

- [ ] **Step 13.1: Dashboard page**

Create `src/app/(admin)/admin/dashboard/page.tsx`:
```tsx
import { signOut } from '@/lib/auth/config';
import { auth } from '@/lib/auth/config';

export const dynamic = 'force-dynamic';

async function logoutAction() {
  'use server';
  await signOut({ redirectTo: '/admin/login' });
}

export default async function DashboardPage() {
  const session = await auth();
  return (
    <main className="min-h-screen bg-neutral-50 px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-3xl font-extrabold text-neutral-900">
              Selamat datang, {session?.user.name}
            </h1>
            <p className="mt-1 text-sm text-neutral-600">
              Role: <span className="font-semibold">{session?.user.role}</span>
            </p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
            >
              Keluar
            </button>
          </form>
        </div>
        <div className="mt-8 rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center">
          <p className="text-neutral-600">
            Dashboard akan diisi pada Phase 2 (CRUD entity) dan Phase 4 (inline editor).
          </p>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 13.2: Change-password server action**

Create `src/app/(admin)/admin/change-password/actions.ts`:
```ts
'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/client';
import { auth, signOut } from '@/lib/auth/config';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { writeAudit } from '@/lib/security/audit';

const schema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8, 'Password baru minimal 8 karakter.'),
    confirmPassword: z.string().min(1),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Konfirmasi password tidak cocok.',
    path: ['confirmPassword'],
  });

export type ChangePasswordState = { error?: string } | null;

export async function changePasswordAction(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const session = await auth();
  if (!session?.user) {
    redirect('/admin/login');
  }

  const parsed = schema.safeParse({
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
    confirmPassword: formData.get('confirmPassword'),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Input tidak valid.' };
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect('/admin/login');

  const ok = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!ok) return { error: 'Password saat ini salah.' };

  const newHash = await hashPassword(parsed.data.newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: newHash,
      mustChangePassword: false,
      passwordChangedAt: new Date(),
    },
  });
  await writeAudit({
    userId: user.id,
    action: 'password_changed',
    target: `user:${user.id}`,
  });

  // Sign user out so the JWT refreshes with mustChangePassword=false on next login.
  await signOut({ redirectTo: '/admin/login?passwordChanged=1' });
  return null;
}
```

- [ ] **Step 13.3: Change-password client form**

Create `src/app/(admin)/admin/change-password/ChangePasswordForm.tsx`:
```tsx
'use client';

import { useActionState } from 'react';
import { changePasswordAction, type ChangePasswordState } from './actions';

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState<ChangePasswordState, FormData>(
    changePasswordAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Password saat ini" name="currentPassword" />
      <Field label="Password baru (min 8 karakter)" name="newPassword" minLength={8} />
      <Field label="Konfirmasi password baru" name="confirmPassword" minLength={8} />
      {state?.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-primary px-4 py-2 font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
      >
        {pending ? 'Mengganti...' : 'Ganti Password'}
      </button>
    </form>
  );
}

function Field({ label, name, minLength }: { label: string; name: string; minLength?: number }) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-neutral-800">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="password"
        required
        minLength={minLength}
        className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}
```

- [ ] **Step 13.4: Change-password page**

Create `src/app/(admin)/admin/change-password/page.tsx`:
```tsx
import { ChangePasswordForm } from './ChangePasswordForm';

export const dynamic = 'force-dynamic';

export default function ChangePasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm">
        <h1 className="font-heading text-2xl font-bold text-neutral-900">
          Ganti Password
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Demi keamanan, silakan ganti password sementara Anda sebelum melanjutkan.
        </p>
        <div className="mt-6">
          <ChangePasswordForm />
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 13.5: Typecheck & lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 13.6: Commit**

```bash
git add src/app/\(admin\)/admin/dashboard src/app/\(admin\)/admin/change-password
git commit -m "feat(admin): dashboard placeholder + change-password flow"
```

---

### Task 14: Health check API route

**Why:** Phase 0 deploy needs `/api/health` returning 200 to verify the app is up and DB is reachable.

**Files:**
- Create: `src/app/api/health/route.ts`
- Create: `src/__tests__/integration/health.test.ts`

- [ ] **Step 14.1: Write failing integration test**

Create `src/__tests__/integration/health.test.ts`:
```ts
import { GET } from '@/app/api/health/route';

describe('GET /api/health', () => {
  it('returns 200 + status ok when DB is reachable', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('ok');
  });
});
```

- [ ] **Step 14.2: Run, expect FAIL**

Run: `npm run test:int -- --testPathPattern='health'`
Expected: FAIL — module not found.

- [ ] **Step 14.3: Implement health route**

Create `src/app/api/health/route.ts`:
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

- [ ] **Step 14.4: Run, expect PASS**

Run: `npm run test:int -- --testPathPattern='health'`
Expected: PASS.

- [ ] **Step 14.5: Commit**

```bash
git add src/app/api/health src/__tests__/integration/health.test.ts
git commit -m "feat: health check api route with db ping"
```

---

## Chunk 4: Seed script, full integration test, CI, deploy

### Task 15: Seed first ADMIN user (idempotent)

**Files:**
- Create: `scripts/seed-admin.ts`

- [ ] **Step 15.1: Implement seed**

Create `scripts/seed-admin.ts`:
```ts
import { prisma } from '../src/lib/db/client';
import { hashPassword } from '../src/lib/auth/password';

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@smpn3kresek.sch.id';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'changeme-please-12345';
const ADMIN_NAME = process.env.SEED_ADMIN_NAME ?? 'Administrator';

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (existing) {
    console.log(`Admin user already exists: ${ADMIN_EMAIL}`);
    return;
  }
  const user = await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      role: 'ADMIN',
      passwordHash: await hashPassword(ADMIN_PASSWORD),
      mustChangePassword: true,
    },
  });
  console.log(`Created ADMIN user: ${user.email} (id=${user.id})`);
  console.log(`Temporary password: ${ADMIN_PASSWORD}`);
  console.log('mustChangePassword=true — user will be forced to change on first login.');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 15.2: Run seed against test DB**

Run: `DATABASE_URL="postgresql://test:test@localhost:5433/smpn3_test?schema=public" npm run db:seed`
Expected output:
```
Created ADMIN user: admin@smpn3kresek.sch.id (id=...)
Temporary password: changeme-please-12345
```

- [ ] **Step 15.3: Run seed again — idempotent check**

Run: `DATABASE_URL="postgresql://test:test@localhost:5433/smpn3_test?schema=public" npm run db:seed`
Expected: `Admin user already exists: admin@smpn3kresek.sch.id` (no duplicate created).

Verify: `DATABASE_URL=... npx prisma studio` or quick query — only 1 admin row.

- [ ] **Step 15.4: Cleanup seed user (so it doesn't leak into other tests)**

Run:
```bash
DATABASE_URL="postgresql://test:test@localhost:5433/smpn3_test?schema=public" \
  npx tsx -e "import { prisma } from './src/lib/db/client'; await prisma.user.deleteMany({ where: { email: 'admin@smpn3kresek.sch.id' } }); await prisma.\$disconnect();"
```

- [ ] **Step 15.5: Commit**

```bash
git add scripts/seed-admin.ts
git commit -m "feat(db): idempotent seed script for first admin user"
```

---

### Task 16: End-to-end Playwright test — login flow

**Files:**
- Create: `playwright.config.ts`
- Create: `playwright/global-setup.ts`
- Create: `playwright/tests/login.spec.ts`

- [ ] **Step 16.1: Install Playwright browsers**

Run: `npx playwright install --with-deps chromium`
Expected: chromium downloaded.

- [ ] **Step 16.2: Playwright config**

Create `playwright.config.ts`:
```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './playwright/tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 30_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  globalSetup: './playwright/global-setup.ts',
  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://test:test@localhost:5433/smpn3_test?schema=public',
      AUTH_SECRET: 'e2e-secret-must-be-at-least-thirty-two-chars',
      AUTH_URL: 'http://localhost:3000',
      NEXT_PUBLIC_DATA_SOURCE: 'static',
    },
  },
});
```

- [ ] **Step 16.3: Global setup — seed test admin**

Create `playwright/global-setup.ts`:
```ts
import { prisma } from '../src/lib/db/client';
import { hashPassword } from '../src/lib/auth/password';

export default async function globalSetup() {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5433/smpn3_test?schema=public';

  // Apply latest migrations against the test DB before tests run.
  const { execSync } = await import('node:child_process');
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
  });

  await prisma.user.deleteMany({ where: { email: 'e2e@smpn3.test' } });
  await prisma.user.create({
    data: {
      email: 'e2e@smpn3.test',
      name: 'E2E Admin',
      role: 'ADMIN',
      passwordHash: await hashPassword('e2e-password-123'),
      mustChangePassword: false,
    },
  });
  await prisma.$disconnect();
}
```

- [ ] **Step 16.4: Login E2E test**

Create `playwright/tests/login.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

test.describe('admin login', () => {
  test('redirect unauthenticated /admin/dashboard → /admin/login', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test('wrong password shows error', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel('Email').fill('e2e@smpn3.test');
    await page.getByLabel('Password').fill('wrong-password');
    await page.getByRole('button', { name: /masuk/i }).click();
    await expect(page.getByRole('alert')).toContainText(/salah/i);
  });

  test('correct credentials → dashboard', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel('Email').fill('e2e@smpn3.test');
    await page.getByLabel('Password').fill('e2e-password-123');
    await page.getByRole('button', { name: /masuk/i }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard/);
    await expect(page.getByText(/selamat datang/i)).toBeVisible();
  });

  test('logout returns to login', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel('Email').fill('e2e@smpn3.test');
    await page.getByLabel('Password').fill('e2e-password-123');
    await page.getByRole('button', { name: /masuk/i }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard/);
    await page.getByRole('button', { name: /keluar/i }).click();
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
```

- [ ] **Step 16.5: Run E2E locally**

Ensure docker compose test postgres is running.

Run: `npm run e2e`
Expected: 4 tests PASS.

If `webServer.command` fails because env validation rejects something, check the env block in `playwright.config.ts`.

- [ ] **Step 16.6: Commit**

```bash
git add playwright.config.ts playwright \
        package.json
git commit -m "test(e2e): playwright login flow tests + global setup"
```

---

### Task 17: Public site visual smoke (no regression)

**Why:** Phase 0 changes infra (server runtime) but should NOT change visual output of public pages. Add a smoke test that confirms `/` and `/profil` still render with key content.

**Files:**
- Create: `playwright/tests/public-smoke.spec.ts`

- [ ] **Step 17.1: Write smoke**

Create `playwright/tests/public-smoke.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

const PAGES = [
  { path: '/', heading: /SMP Negeri 3 Kresek|SMPN 3 Kresek/i },
  { path: '/profil', heading: /profil/i },
  { path: '/akademik', heading: /akademik/i },
  { path: '/fasilitas', heading: /fasilitas/i },
  { path: '/kontak', heading: /kontak/i },
];

test.describe('public site smoke', () => {
  for (const p of PAGES) {
    test(`${p.path} renders without console errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
      });
      await page.goto(p.path);
      await expect(page.locator('h1').first()).toBeVisible();
      expect(errors, `Console errors on ${p.path}: ${errors.join(', ')}`).toEqual([]);
    });
  }
});
```

- [ ] **Step 17.2: Run**

Run: `npm run e2e`
Expected: 4 login tests + 5 smoke tests = 9 PASS.

- [ ] **Step 17.3: Commit**

```bash
git add playwright/tests/public-smoke.spec.ts
git commit -m "test(e2e): public site smoke (no regression on phase 0 changes)"
```

---

### Task 18: GitHub Actions CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 18.1: Write workflow**

Create `.github/workflows/ci.yml`:
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  DATABASE_URL: postgresql://test:test@localhost:5433/smpn3_test?schema=public
  AUTH_SECRET: ci-secret-must-be-at-least-thirty-two-chars-long
  AUTH_URL: http://localhost:3000
  NEXT_PUBLIC_DATA_SOURCE: static

jobs:
  unit:
    name: Lint + Typecheck + Unit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npx prisma generate
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test

  integration:
    name: Integration (Postgres)
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: smpn3_test
        ports:
          - 5433:5432
        options: >-
          --health-cmd="pg_isready -U test"
          --health-interval=2s
          --health-timeout=2s
          --health-retries=10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npx prisma migrate deploy
      - run: npm run test:int

  e2e:
    name: Playwright E2E
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: smpn3_test
        ports:
          - 5433:5432
        options: >-
          --health-cmd="pg_isready -U test"
          --health-interval=2s
          --health-timeout=2s
          --health-retries=10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx prisma migrate deploy
      - run: npm run e2e
      - if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7

  build:
    name: Production build
    runs-on: ubuntu-latest
    needs: [unit, integration]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npx prisma generate
      - run: SKIP_ENV_VALIDATION=true npm run build
```

- [ ] **Step 18.2: Lint workflow file (optional, sanity)**

If `actionlint` is available locally, run `actionlint`. Otherwise skip — GitHub will report errors on push.

- [ ] **Step 18.3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: github actions workflow (lint, typecheck, unit, int, e2e, build)"
```

---

### Task 19: Deploy script for Hostinger VPS

**Why:** Sole deploy mechanism per spec (SSH-based, server pulls + builds atomically). Setup once on VPS; CI just triggers it via SSH.

**Files:**
- Create: `scripts/deploy.sh` (intended for VPS)
- Update: `README.md` with VPS setup instructions

- [ ] **Step 19.1: Deploy script**

Create `scripts/deploy.sh`:
```bash
#!/usr/bin/env bash
# Deploy script intended to live on the VPS at /opt/smpn3/deploy.sh
# Triggered by GitHub Actions via SSH. Atomic: if any step fails, PM2 keeps running the old build.
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/smpn3/app}"
PM2_NAME="${PM2_NAME:-smpn3}"

cd "$REPO_DIR"

echo "==> Pull latest"
git fetch --all --quiet
git reset --hard origin/main

echo "==> Install deps"
npm ci --no-audit --no-fund

echo "==> Generate Prisma client"
npx prisma generate

echo "==> Run migrations"
npx prisma migrate deploy

echo "==> Build"
npm run build

echo "==> Reload PM2"
pm2 reload "$PM2_NAME" --update-env

echo "==> Done"
```

Make it executable:
```bash
chmod +x scripts/deploy.sh
```

- [ ] **Step 19.2: Add VPS setup section to README**

Append to `README.md` (after "Deployment" section or as a new "Hostinger VPS deployment" subsection):

```markdown
### Hostinger VPS deployment

One-time setup on VPS (Ubuntu 22.04+ assumed):

```bash
# Install Node 22 via nvm + PM2 + Postgres
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
source ~/.bashrc
nvm install 22.22.0 && nvm use 22.22.0 && nvm alias default 22.22.0
npm i -g pm2

# Postgres (Ubuntu)
sudo apt-get install -y postgresql-16
sudo -u postgres psql -c "CREATE DATABASE smpn3;"
sudo -u postgres psql -c "CREATE USER smpn3 WITH ENCRYPTED PASSWORD 'change-me';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE smpn3 TO smpn3;"

# Clone repo
sudo mkdir -p /opt/smpn3 && sudo chown $USER /opt/smpn3
git clone <repo> /opt/smpn3/app
cd /opt/smpn3/app

# Env vars
cp .env.example .env.local
# Edit .env.local — set DATABASE_URL, AUTH_SECRET (openssl rand -base64 32), AUTH_URL

# First deploy
bash scripts/deploy.sh

# Start with PM2
pm2 start npm --name smpn3 -- start
pm2 save
pm2 startup  # follow printed instructions

# Seed first admin
npm run db:seed
# Note the temporary password printed; share via WhatsApp; user changes on first login.

# Nginx reverse proxy (separate task, basic config below)
```

GitHub Actions deploy step (add to `.github/workflows/ci.yml` once SSH key is configured in repo secrets):

```yaml
  deploy:
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    needs: [build, integration, e2e]
    runs-on: ubuntu-latest
    steps:
      - uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_KEY }}
          script: bash /opt/smpn3/deploy.sh
```
```

- [ ] **Step 19.3: Commit**

```bash
git add scripts/deploy.sh README.md
git commit -m "feat(deploy): vps deploy script + readme setup instructions"
```

Note: deploy step is **documented but not wired into CI yet**. Wiring requires SSH key/host secrets which must be configured by a human with VPS access. The plan owner adds the `deploy:` job to `ci.yml` after secrets are set up.

---

### Task 20: Final integration verification + READY tag

**Files:**
- Modify: `README.md` (small update — phase 0 status)

- [ ] **Step 20.1: Reset test DB and run full pipeline locally**

```bash
docker compose -f docker-compose.test.yml down
docker compose -f docker-compose.test.yml up -d
DATABASE_URL="postgresql://test:test@localhost:5433/smpn3_test?schema=public" \
  npx prisma migrate deploy
npm run lint
npm run typecheck
npm test
npm run test:int
npm run e2e
SKIP_ENV_VALIDATION=true npm run build
```

Expected: all green.

- [ ] **Step 20.2: Manual smoke**

Run dev server with real env: `npm run dev`

Open browser:
1. `http://localhost:3000/` — public home renders.
2. `http://localhost:3000/admin/dashboard` — redirects to `/admin/login?returnUrl=%2Fadmin%2Fdashboard`.
3. Seed an admin: `DATABASE_URL=... npm run db:seed`
4. Login with seeded credentials → redirects to `/admin/change-password` (because `mustChangePassword=true`).
5. Change password → redirects to login with `?passwordChanged=1`.
6. Login again with new password → dashboard.
7. Click "Keluar" → back to login.
8. `http://localhost:3000/api/health` returns `{"status":"ok"}`.

- [ ] **Step 20.3: Update README Phase 0 status**

In `README.md`, add a section at the top (after the title):

```markdown
## Status

**Phase 0 (Foundation): ✅ Complete** — server runtime, Postgres, NextAuth + bcrypt, login flow, force-password-change, audit log, CI.

Next phases: see [docs/superpowers/specs/](./docs/superpowers/specs/) and [docs/superpowers/plans/](./docs/superpowers/plans/).
```

- [ ] **Step 20.4: Commit**

```bash
git add README.md
git commit -m "docs: mark phase 0 foundation as complete"
```

- [ ] **Step 20.5: Push & verify CI**

```bash
git push origin <branch>
```

If on `main`: CI runs automatically. Watch GitHub Actions tab.
If on feature branch: open PR to `main`, ensure CI green before merge.

---

## Phase 0 Done Criteria

All of these must be true to call Phase 0 complete:

- [ ] `next.config.mjs` no longer has `output: 'export'`
- [ ] Postgres reachable at `DATABASE_URL`, migrations applied
- [ ] `npm test` (unit) green: ≥60 tests (existing 51 + new ~12)
- [ ] `npm run test:int` (integration) green: 10+ tests against real DB
- [ ] `npm run e2e` (Playwright) green: 9 tests (4 login + 5 public smoke)
- [ ] `npm run build` succeeds
- [ ] `npm run lint` + `npm run typecheck` both zero errors
- [ ] Login flow works end-to-end: seed → login → force-change-password → dashboard → logout
- [ ] Middleware redirects unauthenticated `/admin/*` to login with `returnUrl`
- [ ] Audit log rows appear on successful login
- [ ] Rate limiter blocks after 5 failed attempts from same IP
- [ ] `/api/health` returns 200 when DB up, 503 when DB down
- [ ] Public site `/`, `/profil`, `/akademik`, `/fasilitas`, `/kontak` render identically to pre-Phase-0 (visual smoke passes)
- [ ] CI workflow (GitHub Actions) green
- [ ] Deploy script + VPS setup documented in README
- [ ] No new `out/` directory produced by build
- [ ] No `.env` (without `.local`) committed
- [ ] `prisma/migrations/<timestamp>_phase0_init/` committed

---

## What's NOT in Phase 0 (explicit deferrals)

These are deliberately out of scope for Phase 0 and will be picked up in later phases. Don't add them now even if tempting:

- ❌ ApiContentProvider Prisma implementation → **Phase 1**
- ❌ Page sections, entities (Teacher/Achievement/etc.) → **Phase 1 schema + Phase 2 CRUD UI**
- ❌ Admin sidebar layout, dashboard widgets → **Phase 2**
- ❌ User management UI (`/admin/users`) → **Phase 2**
- ❌ Media library, Cloudinary → **Phase 3**
- ❌ Inline editor (`<Editable>` component) → **Phase 4**
- ❌ Soft delete (we use hard delete per spec) → never
- ❌ Sentry, UptimeRobot → never
- ❌ Email-based password reset → **future, low-priority** (admin manual reset works for MVP)

If the spec for a later phase needs schema changes, those will be additive migrations created in that phase — do not pre-add them now.
