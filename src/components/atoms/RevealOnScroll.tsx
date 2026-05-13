'use client';

import type { ReactNode } from 'react';
import { useScrollReveal } from '@lib/hooks/useScrollReveal';
import { cn } from '@lib/utils/cn';

export function RevealOnScroll({ children, className }: { children: ReactNode; className?: string }) {
  const { ref, visible } = useScrollReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={cn('reveal', visible && 'is-visible', className)}>
      {children}
    </div>
  );
}
