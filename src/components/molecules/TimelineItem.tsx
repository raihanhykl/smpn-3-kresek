import type { TimelineItem as TimelineItemData } from '@config/types';

export function TimelineItem({ data, index, total }: { data: TimelineItemData; index: number; total: number }) {
  const isLast = index === total - 1;
  return (
    <li className="relative flex gap-4 pb-6">
      <div className="flex flex-col items-center">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
          {index + 1}
        </span>
        {!isLast ? <span className="mt-1 w-px flex-1 bg-neutral-200" aria-hidden /> : null}
      </div>
      <div className="pb-2">
        <div className="font-semibold text-neutral-900">{data.marker}</div>
        <p className="mt-1 text-sm text-neutral-600">{data.text}</p>
      </div>
    </li>
  );
}
