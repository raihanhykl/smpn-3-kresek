import { auth } from '@/lib/auth/config';
import { AdminShell } from '@/components/admin/AdminShell';
import { getFaqs } from '@/lib/data/repositories/faq-repo';
import { FaqManager } from './FaqManager';

export const dynamic = 'force-dynamic';

export default async function FaqsPage() {
  const session = await auth();
  const items = await getFaqs();
  return (
    <AdminShell userName={session?.user.name ?? 'Admin'} role={session?.user.role ?? 'EDITOR'}>
      <FaqManager initialFaqs={items} />
    </AdminShell>
  );
}
