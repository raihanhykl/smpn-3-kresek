import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-6 text-center">
      <span className="text-6xl" aria-hidden>
        🔍
      </span>
      <h1 className="mt-6 font-heading text-3xl font-extrabold text-neutral-900">Halaman Tidak Ditemukan</h1>
      <p className="mt-3 max-w-sm text-neutral-600">
        Maaf, halaman yang Anda cari tidak tersedia. Silakan kembali ke beranda.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-2 rounded-sm bg-primary px-6 py-3 font-heading font-semibold text-white transition-colors hover:bg-primary-dark"
      >
        ← Kembali ke Beranda
      </Link>
    </main>
  );
}
