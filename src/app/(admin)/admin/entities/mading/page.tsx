import { auth } from '@/lib/auth/config';
import { AdminShell } from '@/components/admin/AdminShell';
import { getAllMading } from '@/lib/data/repositories/mading-repo';
import { MadingManager } from './MadingManager';

export const dynamic = 'force-dynamic';

export default async function MadingPage() {
  const session = await auth();
  const items = await getAllMading();
  return (
    <AdminShell userName={session?.user.name ?? 'Admin'} role={session?.user.role ?? 'EDITOR'}>
      <MadingManager initialItems={items} />
    </AdminShell>
  );
}
