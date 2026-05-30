import type { CSSProperties } from 'react';
import type { Teacher } from '@config/types';
import { cldUrl } from '@/lib/media/cldUrl';

export function TeacherCard({ data }: { data: Teacher }) {
  const photoStyle: CSSProperties =
    data.photo.kind === 'gradient'
      ? { background: `linear-gradient(135deg, ${data.photo.from}, ${data.photo.to})` }
      : {};
  return (
    <div className="overflow-hidden rounded-md bg-white shadow-sm transition-shadow hover:shadow-md">
      <div
        className="flex aspect-[4/5] items-center justify-center text-6xl"
        style={photoStyle}
        aria-label={data.name}
      >
        {data.photo.kind === 'gradient' ? (
          <span>{data.photo.emoji}</span>
        ) : (
          // Phase 3: photo.src holds a Cloudinary publicId; resolve to a real
          // CDN URL via cldUrl. Using the publicId directly in <img src=…>
          // sends the browser to /publicId on our own origin (bug fixed here).
          // eslint-disable-next-line @next/next/no-img-element -- Cloudinary CDN already optimizes
          <img
            src={cldUrl(data.photo.src, 'card')}
            alt={data.photo.alt}
            className="h-full w-full object-cover"
          />
        )}
      </div>
      <div className="p-4">
        <div className="font-semibold text-neutral-900">{data.name}</div>
        <div className="mt-0.5 text-sm text-neutral-500">{data.position}</div>
        <span className="mt-2 inline-flex rounded-full bg-primary-bg px-2 py-0.5 text-[11px] font-bold text-primary">
          {data.badge}
        </span>
      </div>
    </div>
  );
}
