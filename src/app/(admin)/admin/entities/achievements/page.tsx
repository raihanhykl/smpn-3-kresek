import { auth } from '@/lib/auth/config';
import { AdminShell } from '@/components/admin/AdminShell';
import { getAllAchievements } from '@/lib/data/repositories/achievement-repo';
import { AchievementManager } from './AchievementManager';

export const dynamic = 'force-dynamic';

export default async function AchievementsPage() {
  const session = await auth();
  const items = await getAllAchievements();
  return (
    <AdminShell userName={session?.user.name ?? 'Admin'} role={session?.user.role ?? 'EDITOR'}>
      <AchievementManager initialAchievements={items} />
    </AdminShell>
  );
}
