import { execSync } from 'node:child_process';
import { prisma } from '@/lib/db/client';

describe('seed-content script', () => {
  beforeAll(async () => {
    // Clean entity tables before testing seed. (Page text/site/nav are config
    // now — not seeded into the DB.)
    await prisma.teacher.deleteMany({});
    await prisma.achievement.deleteMany({});
    await prisma.extracurricular.deleteMany({});
    await prisma.subject.deleteMany({});
    await prisma.faq.deleteMany({});
    await prisma.galleryItem.deleteMany({});
    await prisma.facility.deleteMany({});
    await prisma.organizationMember.deleteMany({});
    await prisma.documentSlot.deleteMany({});
  }, 30_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('populates all content tables idempotently', async () => {
    // Run twice
    const cmd = 'npx tsx scripts/seed-content.ts';
    execSync(cmd, { stdio: 'pipe', env: process.env, shell: '/bin/bash' });
    const firstCounts = {
      teachers: await prisma.teacher.count(),
      faqs: await prisma.faq.count(),
      achievements: await prisma.achievement.count(),
      gallery: await prisma.galleryItem.count(),
    };

    execSync(cmd, { stdio: 'pipe', env: process.env, shell: '/bin/bash' });
    const secondCounts = {
      teachers: await prisma.teacher.count(),
      faqs: await prisma.faq.count(),
      achievements: await prisma.achievement.count(),
      gallery: await prisma.galleryItem.count(),
    };

    expect(firstCounts).toEqual(secondCounts);
    expect(firstCounts.teachers).toBeGreaterThan(0);
    expect(firstCounts.faqs).toBeGreaterThan(0);
    expect(firstCounts.achievements).toBeGreaterThan(0);
    expect(firstCounts.gallery).toBeGreaterThan(0);
  }, 60_000);
});
