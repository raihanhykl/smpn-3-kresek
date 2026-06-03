import type { CSSProperties } from 'react';
import type { GalleryItem as GalleryItemData } from '@config/types';
import { cldUrl, cropOf } from '@/lib/media/cldUrl';
import { cn } from '@lib/utils/cn';

export function GalleryItem({ data, className }: { data: GalleryItemData; className?: string }) {
  const { photo } = data;
  // Phase 3b: render conditional on the photo discriminator. Gradient branch
  // keeps the emoji-on-gradient placeholder behaviour; url branch renders the
  // Cloudinary asset via cldUrl (the broken-image fallback if the asset is
  // missing is the browser default — proper onError fallback is Phase 5).
  return (
    <div
      className={cn(
        // Phase 4: every gallery card is a uniform 4:3 box so the grid is even
        // and swapping photos is predictable. The crop frame in the admin uses
        // the same 4:3 ratio, so what the admin sets is exactly what renders.
        'group relative aspect-[4/3] overflow-hidden rounded-md shadow-sm transition-all hover:shadow-md',
        className,
      )}
    >
      {photo.kind === 'url' ? (
        // eslint-disable-next-line @next/next/no-img-element -- Cloudinary CDN already optimises
        <img
          src={cldUrl(photo.src, 'card', cropOf(photo))}
          alt={photo.alt}
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center text-6xl"
          style={{ background: `linear-gradient(135deg, ${photo.from}, ${photo.to})` } satisfies CSSProperties}
        >
          <span aria-hidden>{photo.emoji}</span>
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 flex items-end bg-gradient-to-t from-black/70 via-black/0 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
        <span className="p-4 text-sm font-medium text-white">{data.caption}</span>
      </div>
      <span className="sr-only">{data.caption}</span>
    </div>
  );
}
