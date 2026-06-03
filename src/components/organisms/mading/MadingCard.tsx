import Link from 'next/link';
import { cldUrl } from '@/lib/media/cldUrl';
import type { Mading } from '@config/types';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function MadingCard({ item }: { item: Mading }) {
  const cover = item.images[0];
  return (
    <Link
      href={`/mading/${item.id}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm transition hover:shadow-md"
    >
      {cover ? (
        <div className="relative aspect-[16/9] overflow-hidden bg-neutral-100">
          {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary CDN */}
          <img src={cldUrl(cover.src, 'card')} alt={cover.alt} className="h-full w-full object-cover transition group-hover:scale-105" />
          {item.images.length > 1 ? (
            <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">📷 {item.images.length}</span>
          ) : null}
        </div>
      ) : (
        <div className="flex aspect-[16/9] items-center justify-center bg-gradient-to-br from-primary to-primary-light text-5xl text-white" aria-hidden>📝</div>
      )}
      <div className="flex flex-1 flex-col p-4">
        <time className="text-xs font-medium text-neutral-500">{formatDate(item.createdAt)}</time>
        <h3 className="mt-1 font-heading text-lg font-bold leading-snug text-neutral-900 line-clamp-2">{item.title}</h3>
        {item.body ? <p className="mt-2 text-sm text-neutral-600 line-clamp-3">{item.body}</p> : null}
      </div>
    </Link>
  );
}
