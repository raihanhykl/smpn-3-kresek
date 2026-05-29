import { auth } from '@/lib/auth/config';
import { AdminShell } from '@/components/admin/AdminShell';
import { getAllSubjects } from '@/lib/data/repositories/subject-repo';
import { SubjectManager } from './SubjectManager';

export const dynamic = 'force-dynamic';

export default async function SubjectsPage() {
  const session = await auth();
  const items = await getAllSubjects();
  return (
    <AdminShell userName={session?.user.name ?? 'Admin'} role={session?.user.role ?? 'EDITOR'}>
      <SubjectManager initialItems={items} />
    </AdminShell>
  );
}
