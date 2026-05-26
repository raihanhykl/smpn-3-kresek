import type { ReactNode } from 'react';

/**
 * Admin route group layout.
 * Phase 0 keeps this minimal — auth guard lives in middleware.ts.
 * Phase 2 will replace this with proper admin shell (sidebar + topbar).
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
