import { auth } from '@/lib/auth/config';
import { AdminShell } from '@/components/admin/AdminShell';
import { getAllFacilities } from '@/lib/data/repositories/facility-repo';
import { FacilityManager } from './FacilityManager';

export const dynamic = 'force-dynamic';

export default async function FacilitiesPage() {
  const session = await auth();
  const items = await getAllFacilities();
  return (
    <AdminShell userName={session?.user.name ?? 'Admin'} role={session?.user.role ?? 'EDITOR'}>
      <FacilityManager initialItems={items} />
    </AdminShell>
  );
}
