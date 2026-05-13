import type { CSSProperties } from 'react';
import type { GalleryItem as GalleryItemData } from '@config/types';
import { cn } from '@lib/utils/cn';

export function GalleryItem({ data, className }: { data: GalleryItemData; className?: string }) {
  const style: CSSProperties = {
    background: `linear-gradient(135deg, ${data.gradientFrom}, ${data.gradientTo})`,
  };
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-md shadow-sm transition-all hover:shadow-md',
        className,
      )}
    >
      <div className="flex h-full min-h-[180px] items-center justify-center text-6xl" style={style}>
        <span aria-hidden>{data.emoji}</span>
      </div>
      <div className="pointer-events-none absolute inset-0 flex items-end bg-gradient-to-t from-black/70 via-black/0 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
        <span className="p-4 text-sm font-medium text-white">{data.caption}</span>
      </div>
      <span className="sr-only">{data.caption}</span>
    </div>
  );
}
