import { auth } from '@/lib/auth/config';
import { AdminShell } from '@/components/admin/AdminShell';
import { getAllGalleryItems } from '@/lib/data/repositories/gallery-repo';
import { GalleryItemManager } from './GalleryItemManager';

export const dynamic = 'force-dynamic';

export default async function GalleryPage() {
  const session = await auth();
  const items = await getAllGalleryItems();
  return (
    <AdminShell userName={session?.user.name ?? 'Admin'} role={session?.user.role ?? 'EDITOR'}>
      <GalleryItemManager initialItems={items} />
    </AdminShell>
  );
}
