import { auth } from '@/lib/auth/config';
import { AdminShell } from '@/components/admin/AdminShell';
import { getTeachers } from '@/lib/data/repositories/teacher-repo';
import { TeacherManager } from './TeacherManager';

export const dynamic = 'force-dynamic';

export default async function TeachersPage() {
  const session = await auth();
  const teachers = await getTeachers();
  return (
    <AdminShell userName={session?.user.name ?? 'Admin'} role={session?.user.role ?? 'EDITOR'}>
      <TeacherManager initialTeachers={teachers} />
    </AdminShell>
  );
}
