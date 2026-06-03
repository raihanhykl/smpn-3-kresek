import { auth } from '@/lib/auth/config';
import { AdminShell } from '@/components/admin/AdminShell';
import { getAllOrganizationMembers } from '@/lib/data/repositories/organization-repo';
import { OrganizationMemberManager } from './OrganizationMemberManager';

export const dynamic = 'force-dynamic';

export default async function OrganizationPage() {
  const session = await auth();
  const items = await getAllOrganizationMembers();
  return (
    <AdminShell userName={session?.user.name ?? 'Admin'} role={session?.user.role ?? 'EDITOR'}>
      <OrganizationMemberManager initialItems={items} />
    </AdminShell>
  );
}
