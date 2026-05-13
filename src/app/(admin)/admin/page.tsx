export default function AdminPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-6 text-center">
      <span className="text-6xl" aria-hidden>
        🚧
      </span>
      <h1 className="mt-6 font-heading text-3xl font-extrabold text-neutral-900">Admin Dashboard</h1>
      <p className="mt-3 max-w-md text-neutral-600">
        Dashboard administrasi sedang dalam pengembangan. Aktifkan dengan{' '}
        <code className="rounded bg-neutral-200 px-1.5 py-0.5 text-xs">NEXT_PUBLIC_DATA_SOURCE=api</code> setelah backend
        tersedia.
      </p>
    </main>
  );
}
