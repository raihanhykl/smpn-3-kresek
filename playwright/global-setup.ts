import { prisma } from '../src/lib/db/client';
import { hashPassword } from '../src/lib/auth/password';

export default async function globalSetup() {
  process.env.DATABASE_URL ??=
    'postgresql://test:test@localhost:5433/smpn3_test?schema=public';

  // Apply latest migrations against the test DB before tests run.
  const { execSync } = await import('node:child_process');
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
  });

  // Wipe ALL teachers before re-seeding so the teacher set is fully deterministic.
  // The content seed re-creates only the canonical p*/g*/t* teachers (via upsert
  // from profilPageConfig.guru.teachers); it never deletes unknown rows, so stale
  // cuid()-id teachers from prior admin-CRUD runs would otherwise persist and shift
  // /profil page height, breaking the visual baseline. Full deleteMany guarantees a
  // stable, repeatable set on every E2E run.
  await prisma.teacher.deleteMany({});

  // Seed content tables. Idempotent + required for api-source E2E so the
  // webServer (built with NEXT_PUBLIC_DATA_SOURCE=api) can resolve content
  // from the database during page rendering. Re-creates the canonical teacher set
  // wiped above.
  execSync('npx tsx scripts/seed-content.ts', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
  });

  // Wipe AuditLog rows that reference the e2e users first, otherwise the
  // FK (AuditLog.userId → User.id) blocks user deletion on re-runs.
  const existing = await prisma.user.findMany({
    where: { email: { in: ['e2e@smpn3.test', 'e2e-must-change@smpn3.test'] } },
    select: { id: true },
  });
  if (existing.length > 0) {
    await prisma.auditLog.deleteMany({
      where: { userId: { in: existing.map((u) => u.id) } },
    });
  }
  await prisma.user.deleteMany({
    where: { email: { in: ['e2e@smpn3.test', 'e2e-must-change@smpn3.test'] } },
  });
  await prisma.user.create({
    data: {
      email: 'e2e@smpn3.test',
      name: 'E2E Admin',
      role: 'ADMIN',
      passwordHash: await hashPassword('e2e-password-123'),
      mustChangePassword: false,
    },
  });
  await prisma.user.create({
    data: {
      email: 'e2e-must-change@smpn3.test',
      name: 'E2E Force Change',
      role: 'EDITOR',
      passwordHash: await hashPassword('temp-password-123'),
      mustChangePassword: true,
    },
  });
  await prisma.$disconnect();
}
