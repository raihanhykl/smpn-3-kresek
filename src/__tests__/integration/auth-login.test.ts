import { prisma } from '@/lib/db/client';
import { hashPassword } from '@/lib/auth/password';
import { authConfig } from '@/lib/auth/config';
import { loginRateLimiter } from '@/lib/auth/rate-limit';

// Extract the credentials provider's authorize for direct invocation.
// NextAuth v5 wraps the provider config: `provider.authorize` is a native
// validator/normalizer that requires a real Request, while the original
// async function we passed lives at `provider.options.authorize`. We invoke
// the latter to exercise our actual logic without standing up the HTTP stack.
function getAuthorize() {
  const provider = authConfig.providers[0] as unknown as {
    options: {
      authorize: (
        creds: { email: string; password: string } | undefined,
        req: { headers: Headers },
      ) => Promise<unknown>;
    };
  };
  return provider.options.authorize.bind(provider.options);
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

  // The rate limiter is a module-level singleton, and getClientIp() returns null
  // outside a Next request scope, so the limiter keys all calls by TEST_EMAIL.
  // Reset between tests so each `it` starts with a fresh bucket — otherwise the
  // 5-attempt cap leaks across tests and produces order-dependent failures.
  beforeEach(() => {
    loginRateLimiter.resetForTests();
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

describe('jwt + session callbacks (mustChangePassword propagation)', () => {
  it('jwt callback carries mustChangePassword from user into token', async () => {
    const { authConfigEdge } = await import('@/lib/auth/config.edge');
    const jwtCb = authConfigEdge.callbacks!.jwt!;
    const token = await jwtCb({
      token: {} as never,
      user: {
        id: 'u-x',
        email: 'x@test',
        name: 'X',
        role: 'EDITOR',
        mustChangePassword: true,
      } as never,
    } as never);
    expect(token).toMatchObject({
      id: 'u-x',
      role: 'EDITOR',
      mustChangePassword: true,
    });
  });

  it('session callback projects token into session.user', async () => {
    const { authConfigEdge } = await import('@/lib/auth/config.edge');
    const sessionCb = authConfigEdge.callbacks!.session!;
    const session = await sessionCb({
      session: { user: { email: 'x@test', name: 'X' } } as never,
      token: { id: 'u-x', role: 'ADMIN', mustChangePassword: false } as never,
    } as never);
    expect(session).toMatchObject({
      user: { id: 'u-x', role: 'ADMIN', mustChangePassword: false },
    });
  });
});
