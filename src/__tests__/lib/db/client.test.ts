/**
 * @jest-environment node
 */
// IMPORTANT: PrismaClient requires Node APIs (process.binding, fs, etc.) and crashes
// in jsdom. Override the default env (jsdom) per-file with the docblock above.

describe('prisma singleton', () => {
  afterEach(() => {
    jest.resetModules();
  });

  it('returns same instance on multiple imports', () => {
    process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5433/smpn3_test?schema=public';
    let a: unknown, b: unknown;
    jest.isolateModules(() => {
      a = require('@/lib/db/client').prisma;
      b = require('@/lib/db/client').prisma;
    });
    expect(a).toBe(b);
  });
});
