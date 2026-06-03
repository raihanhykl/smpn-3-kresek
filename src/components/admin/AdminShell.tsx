import type { ReactNode } from 'react';
import { AdminSidebar } from './AdminSidebar';
import { logoutAction } from '@/app/(admin)/admin/dashboard/actions';
import type { Role } from '@/lib/auth/require-role';

export function AdminShell({
  children,
  userName,
  role,
}: {
  children: ReactNode;
  userName: string;
  role: Role;
}) {
  return (
    <div className="flex min-h-screen bg-neutral-50">
      <AdminSidebar role={role} />
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-6">
          <span className="text-sm text-neutral-500">Panel Pengelolaan Konten</span>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-neutral-700">{userName}</span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
              >
                Keluar
              </button>
            </form>
          </div>
        </header>
        <main className="flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
