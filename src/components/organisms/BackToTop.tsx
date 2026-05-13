'use client';

import { useScrollY } from '@lib/hooks/useScrollY';
import { cn } from '@lib/utils/cn';

export function BackToTop() {
  const show = useScrollY(400);
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Kembali ke atas"
      className={cn(
        'fixed bottom-8 right-8 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg text-white shadow-lg transition-all hover:bg-primary-dark hover:-translate-y-0.5',
        show ? 'opacity-100 translate-y-0' : 'pointer-events-none translate-y-4 opacity-0',
      )}
    >
      ↑
    </button>
  );
}
