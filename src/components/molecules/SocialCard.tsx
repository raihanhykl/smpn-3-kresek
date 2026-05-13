import type { SocialLink } from '@config/types';
import { cn } from '@lib/utils/cn';

const accents: Record<SocialLink['platform'], string> = {
  instagram: 'hover:bg-[#FDF4FF]',
  facebook: 'hover:bg-[#EFF6FF]',
  youtube: 'hover:bg-[#FEE2E2]',
  tiktok: 'hover:bg-[#F1F5F9]',
};

export function SocialCard({ data }: { data: SocialLink }) {
  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'flex items-center gap-3 rounded-md border border-neutral-200 bg-white p-4 transition-all',
        accents[data.platform],
      )}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-2xl">
        <span>{data.icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold capitalize text-neutral-900">{data.platform}</div>
        <div className="text-xs text-neutral-500 truncate">{data.handle}</div>
      </div>
      <span className="rounded-sm bg-primary-bg px-3 py-1 text-xs font-semibold text-primary">{data.cta}</span>
    </a>
  );
}
