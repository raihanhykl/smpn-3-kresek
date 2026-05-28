import { auth } from '@/lib/auth/config';
import { AdminShell } from '@/components/admin/AdminShell';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await auth();
  const name = session?.user.name ?? 'Admin';
  const role = session?.user.role ?? 'EDITOR';
  return (
    <AdminShell userName={name} role={role}>
      <h1 className="font-heading text-2xl font-extrabold text-neutral-900">Dashboard</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Selamat datang. Pilih menu di samping untuk mengelola konten website.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <DashCard href="/admin/entities/teachers" icon="👩‍🏫" title="Guru & Staf" desc="Kelola data guru dan staf" />
        <DashCard href="/admin/entities/achievements" icon="🏆" title="Prestasi" desc="Kelola daftar prestasi sekolah" />
        <DashCard href="/admin/entities/faqs" icon="❓" title="FAQ" desc="Kelola pertanyaan umum" />
      </div>
    </AdminShell>
  );
}

function DashCard({ href, icon, title, desc }: { href: string; icon: string; title: string; desc: string }) {
  return (
    <a
      href={href}
      className="rounded-xl border border-neutral-200 bg-white p-5 transition hover:border-primary hover:shadow-sm"
    >
      <span className="text-2xl" aria-hidden>{icon}</span>
      <h2 className="mt-2 font-semibold text-neutral-900">{title}</h2>
      <p className="mt-1 text-sm text-neutral-500">{desc}</p>
    </a>
  );
}
