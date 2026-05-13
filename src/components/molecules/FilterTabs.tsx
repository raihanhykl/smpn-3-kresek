'use client';

import { cn } from '@lib/utils/cn';

export interface FilterTab<T extends string> {
  value: T;
  label: string;
}

export interface FilterTabsProps<T extends string> {
  tabs: FilterTab<T>[];
  active: T;
  onChange: (value: T) => void;
  className?: string;
  variant?: 'pill' | 'underline';
}

export function FilterTabs<T extends string>({
  tabs,
  active,
  onChange,
  className,
  variant = 'pill',
}: FilterTabsProps<T>) {
  return (
    <div className={cn('flex flex-wrap items-center justify-center gap-2', className)} role="tablist">
      {tabs.map((t) => {
        const isActive = t.value === active;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.value)}
            className={cn(
              'transition-colors',
              variant === 'pill'
                ? cn(
                    'rounded-full px-4 py-2 text-sm font-semibold',
                    isActive ? 'bg-primary text-white' : 'bg-white text-neutral-700 border border-neutral-200 hover:bg-primary-bg hover:text-primary',
                  )
                : cn(
                    'border-b-2 pb-2 px-3 text-sm font-semibold',
                    isActive ? 'border-primary text-primary' : 'border-transparent text-neutral-600 hover:text-primary',
                  ),
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
