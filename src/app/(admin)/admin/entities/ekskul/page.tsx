import { auth } from '@/lib/auth/config';
import { AdminShell } from '@/components/admin/AdminShell';
import { getExtracurriculars } from '@/lib/data/repositories/extracurricular-repo';
import { ExtracurricularManager } from './ExtracurricularManager';

export const dynamic = 'force-dynamic';

export default async function EkskulPage() {
  const session = await auth();
  const items = await getExtracurriculars();
  return (
    <AdminShell userName={session?.user.name ?? 'Admin'} role={session?.user.role ?? 'EDITOR'}>
      <ExtracurricularManager initialItems={items} />
    </AdminShell>
  );
}
