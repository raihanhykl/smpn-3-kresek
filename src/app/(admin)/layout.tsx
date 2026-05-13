import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * Admin route group — disabled in static mode.
 * When NEXT_PUBLIC_DATA_SOURCE !== "api", any /admin/* route resolves to
 * the global 404 page so that the static export build remains clean.
 *
 * When the future Node/Express backend lands, set NEXT_PUBLIC_DATA_SOURCE=api
 * and the admin tree activates without any code changes here.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  if (process.env.NEXT_PUBLIC_DATA_SOURCE !== 'api') {
    notFound();
  }
  return <>{children}</>;
}
