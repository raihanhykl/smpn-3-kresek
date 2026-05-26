import { auth } from '@/lib/auth/config';
import { logoutAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await auth();
  return (
    <main className="min-h-screen bg-neutral-50 px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-3xl font-extrabold text-neutral-900">
              Selamat datang, {session?.user.name}
            </h1>
            <p className="mt-1 text-sm text-neutral-600">
              Role: <span className="font-semibold">{session?.user.role}</span>
            </p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
            >
              Keluar
            </button>
          </form>
        </div>
        <div className="mt-8 rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center">
          <p className="text-neutral-600">
            Dashboard akan diisi pada Phase 2 (CRUD entity) dan Phase 4 (inline editor).
          </p>
        </div>
      </div>
    </main>
  );
}
