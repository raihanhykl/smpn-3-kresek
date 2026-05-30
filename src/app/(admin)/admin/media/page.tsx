import { auth } from '@/lib/auth/config';
import { AdminShell } from '@/components/admin/AdminShell';
import { MediaManager } from './MediaManager';

export const dynamic = 'force-dynamic';

export default async function MediaPage() {
  const session = await auth();
  return (
    <AdminShell userName={session?.user.name ?? 'Admin'} role={session?.user.role ?? 'EDITOR'}>
      <MediaManager role={session?.user.role ?? 'EDITOR'} />
    </AdminShell>
  );
}
