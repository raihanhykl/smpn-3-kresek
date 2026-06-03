import { config as loadEnv } from 'dotenv';
import { prisma } from '../src/lib/db/client';
import { hashPassword } from '../src/lib/auth/password';

export default async function globalSetup() {
  // Playwright does not auto-load .env.local, so pull TEST_DATABASE_URL from it.
  loadEnv({ path: '.env.local' });

  // Force the dedicated test DB. Locally this comes from TEST_DATABASE_URL
  // (.env.local, gitignored); a plain `??=` could leave the DEV url in place and
  // let E2E seed/wipe real dev data. CI provides DATABASE_URL via env, which we honor.
  process.env.DATABASE_URL = process.env.CI
    ? process.env.DATABASE_URL
    : process.env.TEST_DATABASE_URL;
  if (!process.env.DATABASE_URL) {
    throw new Error('TEST_DATABASE_URL is not set — add it to .env.local (see .env.example).');
  }

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
