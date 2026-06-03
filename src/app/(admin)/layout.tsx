import type { ReactNode } from 'react';
import { ImagePickerProvider } from '@/components/admin/media/ImagePickerProvider';

/**
 * Admin route group layout. Auth guard lives in middleware.ts.
 *
 * Phase 3: ImagePickerProvider mounts a single modal at the layout level so
 * entity drawers can open + close without unmounting the picker mid-flow.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <ImagePickerProvider>{children}</ImagePickerProvider>;
}
