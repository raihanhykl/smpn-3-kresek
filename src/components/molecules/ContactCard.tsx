import { cn } from '@lib/utils/cn';
import type { ContactCard as ContactCardData } from '@config/types';

export function ContactCard({ data }: { data: ContactCardData }) {
  return (
    <div className="flex items-start gap-4 rounded-md border border-neutral-200 bg-white p-5 transition-all hover:border-primary">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-bg text-2xl">
        <span>{data.icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">{data.label}</div>
        <div className="mt-1 font-semibold text-neutral-900 break-words">{data.value}</div>
        <div
          className={cn(
            'mt-0.5 text-sm leading-relaxed',
            data.kind === 'hours' && data.subTone === 'warn' ? 'text-[#EF4444]' : 'text-neutral-600',
          )}
        >
          {data.sub}
        </div>
        {data.kind !== 'hours' && data.linkText && data.href ? (
          <a
            href={data.href}
            className="mt-2 inline-block text-sm font-semibold text-primary transition-colors hover:text-primary-dark"
          >
            {data.linkText}
          </a>
        ) : null}
      </div>
    </div>
  );
}
