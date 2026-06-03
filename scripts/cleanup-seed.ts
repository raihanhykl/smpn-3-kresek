import { prisma } from '../src/lib/db/client';

async function main() {
  const deleted = await prisma.user.deleteMany({
    where: { email: process.env.SEED_ADMIN_EMAIL ?? 'admin@smpn3kresek.sch.id' },
  });
  console.log(`Deleted ${deleted.count} seed admin user(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
