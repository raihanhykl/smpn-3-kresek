import { execSync } from 'node:child_process';
import { prisma } from '@/lib/db/client';

describe('seed-content script', () => {
  beforeAll(async () => {
    // Clean entire content schema before testing seed.
    await prisma.pageSection.deleteMany({});
    await prisma.siteConfig.deleteMany({});
    await prisma.navigation.deleteMany({});
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
      site: await prisma.siteConfig.count(),
      nav: await prisma.navigation.count(),
      sections: await prisma.pageSection.count(),
      teachers: await prisma.teacher.count(),
      faqs: await prisma.faq.count(),
    };

    execSync(cmd, { stdio: 'pipe', env: process.env, shell: '/bin/bash' });
    const secondCounts = {
      site: await prisma.siteConfig.count(),
      nav: await prisma.navigation.count(),
      sections: await prisma.pageSection.count(),
      teachers: await prisma.teacher.count(),
      faqs: await prisma.faq.count(),
    };

    expect(firstCounts).toEqual(secondCounts);
    expect(firstCounts.site).toBe(1);
    expect(firstCounts.nav).toBe(1);
    expect(firstCounts.sections).toBeGreaterThan(20);  // at least ~30 page sections total
    expect(firstCounts.teachers).toBeGreaterThan(0);
    expect(firstCounts.faqs).toBeGreaterThan(0);
  }, 60_000);
});
