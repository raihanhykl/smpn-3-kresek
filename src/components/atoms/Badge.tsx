import type { ReactNode } from 'react';
import { cn } from '@lib/utils/cn';

export interface BadgeProps {
  children: ReactNode;
  className?: string;
  tone?: 'primary' | 'secondary' | 'accent' | 'neutral';
}

const tones: Record<NonNullable<BadgeProps['tone']>, string> = {
  primary: 'bg-primary-bg text-primary',
  secondary: 'bg-secondary-bg text-secondary',
  accent: 'bg-accent-bg text-accent',
  neutral: 'bg-neutral-100 text-neutral-700',
};

export function Badge({ children, className, tone = 'primary' }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold', tones[tone], className)}>
      {children}
    </span>
  );
}
