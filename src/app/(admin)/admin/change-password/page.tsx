import { ChangePasswordForm } from './ChangePasswordForm';

export const dynamic = 'force-dynamic';

export default function ChangePasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm">
        <h1 className="font-heading text-2xl font-bold text-neutral-900">
          Ganti Password
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Demi keamanan, silakan ganti password sementara Anda sebelum melanjutkan.
        </p>
        <div className="mt-6">
          <ChangePasswordForm />
        </div>
      </div>
    </main>
  );
}
