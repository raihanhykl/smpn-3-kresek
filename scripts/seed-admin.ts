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
