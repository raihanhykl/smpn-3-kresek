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

  // Documents the contract that auth flow (Chunk 3) relies on:
  // writeAudit can throw, and callers MUST use .catch(() => {}) to ensure
  // audit failures never block auth.
  it('throws on FK violation when userId does not exist (caller must catch)', async () => {
    await expect(
      writeAudit({ userId: 'nonexistent-user-id', action: 'x', target: 'y' }),
    ).rejects.toThrow();
  });

  // Index sanity: ensure a representative query for the audit "history drawer"
  // works (Phase 4 use case). If indexes drift, this stays green but slow —
  // catching that is for production monitoring, not unit tests.
  it('supports per-user history query (uses [userId, createdAt] index)', async () => {
    const rows = await prisma.auditLog.findMany({
      where: { userId: 'audit-test-user' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });
});
