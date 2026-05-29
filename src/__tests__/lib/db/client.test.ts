/**
 * @jest-environment node
 */
// IMPORTANT: PrismaClient requires Node APIs (process.binding, fs, etc.) and crashes
// in jsdom. Override the default env (jsdom) per-file with the docblock above.
//
// PrismaClient constructor throws PrismaClientInitializationError if DATABASE_URL is
// unset, so the ??= below provides a default for test environments that don't
// pre-populate it. In CI the real env wins.

// This suite never opens a real connection — it only asserts singleton identity —
// so any syntactically valid URL satisfies the PrismaClient constructor. No real
// credentials here on purpose.
const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://user:pass@localhost:5432/placeholder?schema=public';

describe('prisma singleton', () => {
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
  const globalAny = globalThis as unknown as { prisma?: unknown };

  afterEach(() => {
    jest.resetModules();
    delete globalAny.prisma;
    if (ORIGINAL_NODE_ENV === undefined) {
      delete (process.env as Record<string, string | undefined>).NODE_ENV;
    } else {
      (process.env as Record<string, string | undefined>).NODE_ENV = ORIGINAL_NODE_ENV;
    }
  });

  it('returns same instance on multiple imports within a single module-cache scope', () => {
    process.env.DATABASE_URL ??= TEST_DB_URL;
    let a: unknown, b: unknown;
    jest.isolateModules(() => {
      a = require('@/lib/db/client').prisma;
      b = require('@/lib/db/client').prisma;
    });
    expect(a).toBe(b);
  });

  // Without the globalForPrisma cache, hot-reload (which clears the Node module cache
  // but not globalThis) would create a new PrismaClient per HMR cycle and exhaust the
  // connection pool. Simulate that by reloading the module twice via separate
  // isolateModules blocks — same instance proves the global-cache code path works.
  it('reuses the same instance across module reloads via globalThis (dev/test hot-reload safety)', () => {
    process.env.DATABASE_URL ??= TEST_DB_URL;
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
    let a: unknown, b: unknown;
    jest.isolateModules(() => {
      a = require('@/lib/db/client').prisma;
    });
    jest.isolateModules(() => {
      b = require('@/lib/db/client').prisma;
    });
    expect(a).toBe(b);
    expect(globalAny.prisma).toBe(a);
  });

  // In production we deliberately skip the globalThis cache: PM2/server runtime has no
  // hot reload, so Node's module cache alone guarantees singleton identity, and we
  // avoid leaking onto globalThis. Guard against accidentally inverting the conditional.
  it('does not populate globalThis.prisma when NODE_ENV=production', () => {
    process.env.DATABASE_URL ??= TEST_DB_URL;
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    jest.isolateModules(() => {
      require('@/lib/db/client');
    });
    expect(globalAny.prisma).toBeUndefined();
  });
});
