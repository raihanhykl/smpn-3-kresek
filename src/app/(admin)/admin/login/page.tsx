import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/config';
import { LoginForm } from './LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnUrl?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const returnUrl = params.returnUrl ?? '/admin/dashboard';

  if (session?.user) {
    if (session.user.mustChangePassword) redirect('/admin/change-password');
    redirect(returnUrl);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm">
        <h1 className="font-heading text-2xl font-bold text-neutral-900">
          Masuk Admin
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Dashboard pengelolaan website SMPN 3 Kresek
        </p>
        <div className="mt-6">
          <LoginForm returnUrl={returnUrl} />
        </div>
      </div>
    </main>
  );
}
