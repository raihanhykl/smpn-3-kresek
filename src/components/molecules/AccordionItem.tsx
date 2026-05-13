'use client';

import type { ReactNode } from 'react';
import { cn } from '@lib/utils/cn';

export interface AccordionItemProps {
  id: string;
  icon?: string;
  title: string;
  open: boolean;
  onToggle: (id: string) => void;
  children: ReactNode;
}

export function AccordionItem({ id, icon, title, open, onToggle, children }: AccordionItemProps) {
  return (
    <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className={cn(
          'flex w-full items-center gap-3 px-5 py-4 text-left transition-colors',
          open ? 'bg-primary-bg' : 'hover:bg-neutral-50',
        )}
        aria-expanded={open}
        aria-controls={`acc-${id}`}
      >
        {icon ? (
          <span className="text-xl" aria-hidden>
            {icon}
          </span>
        ) : null}
        <span className="flex-1 font-semibold text-neutral-900">{title}</span>
        <span
          aria-hidden
          className={cn('transition-transform duration-300', open ? 'rotate-180 text-primary' : 'text-neutral-400')}
        >
          ▾
        </span>
      </button>
      <div
        id={`acc-${id}`}
        role="region"
        className={cn('grid transition-[grid-template-rows] duration-300', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}
      >
        <div className="overflow-hidden">
          <div className="px-5 pb-5 pt-2 text-sm leading-relaxed text-neutral-600">{children}</div>
        </div>
      </div>
    </div>
  );
}
