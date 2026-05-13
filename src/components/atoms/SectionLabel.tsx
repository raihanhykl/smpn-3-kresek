import type { ReactNode } from 'react';
import { cn } from '@lib/utils/cn';

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-block rounded-full bg-primary-bg px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-primary',
        className,
      )}
    >
      {children}
    </span>
  );
}
