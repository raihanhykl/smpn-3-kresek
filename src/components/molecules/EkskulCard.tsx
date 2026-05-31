import { Badge } from '@components/atoms/Badge';
import { cldUrl } from '@/lib/media/cldUrl';
import type { Extracurricular, EkskulCategory } from '@config/types';

const tones: Record<EkskulCategory, { bg: string; color: string; label: string }> = {
  wajib: { bg: '#FEE2E2', color: '#991B1B', label: 'Wajib' },
  olahraga: { bg: '#D1FAE5', color: '#065F46', label: 'Olahraga' },
  seni: { bg: '#F3E8FF', color: '#581C87', label: 'Seni' },
  akademik: { bg: '#DBEAFE', color: '#1D4ED8', label: 'Akademik' },
  keagamaan: { bg: '#FEF9C3', color: '#713F12', label: 'Keagamaan' },
  lainnya: { bg: '#F1F5F9', color: '#334155', label: 'Lainnya' },
};

export function EkskulCard({ data }: { data: Extracurricular }) {
  const tone = tones[data.category];
  const { photo } = data;
  return (
    <div className="overflow-hidden rounded-md bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative aspect-video">
        {photo.kind === 'url' ? (
          // eslint-disable-next-line @next/next/no-img-element -- Cloudinary CDN already optimises
          <img
            src={cldUrl(photo.src, 'card')}
            alt={photo.alt}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-5xl"
            style={{ background: `linear-gradient(135deg, ${photo.from}, ${photo.to})` }}
          >
            <span aria-hidden>{photo.emoji}</span>
          </div>
        )}
        <span
          className="absolute right-3 top-3 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide"
          style={{ background: tone.bg, color: tone.color }}
        >
          {tone.label}
        </span>
      </div>
      <div className="p-5">
        <h3 className="font-heading text-lg font-bold text-neutral-900">{data.name}</h3>
        <p className="mt-1 text-sm text-neutral-600">{data.description}</p>
        <div className="mt-3 flex flex-col gap-1 text-xs text-neutral-500">
          <span>
            <span aria-hidden>👤</span> Pembina: {data.pembina}
          </span>
          <span>
            <span aria-hidden>📅</span> Jadwal: {data.schedule}
          </span>
        </div>
        {data.achievement ? (
          <Badge tone="secondary" className="mt-3">
            🏆 {data.achievement}
          </Badge>
        ) : null}
      </div>
    </div>
  );
}
