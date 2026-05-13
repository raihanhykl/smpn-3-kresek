'use client';

import { useEffect, useState } from 'react';

/**
 * Returns `true` when `window.scrollY` exceeds `threshold`.
 * Used by the navbar (transparent → solid) and the back-to-top button.
 */
export function useScrollY(threshold: number): boolean {
  const [past, setPast] = useState(false);

  useEffect(() => {
    const handler = (): void => {
      setPast(window.scrollY > threshold);
    };
    handler();
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, [threshold]);

  return past;
}
