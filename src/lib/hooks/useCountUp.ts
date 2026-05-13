'use client';

import { useEffect, useState } from 'react';

export interface UseCountUpArgs {
  target: number;
  durationMs?: number;
  start: boolean;
}

/**
 * Counts up from 0 to `target` over `durationMs` once `start` flips to true.
 * Uses requestAnimationFrame; safe to call on the server (will just return 0
 * until effect runs).
 */
export function useCountUp({ target, durationMs = 1400, start }: UseCountUpArgs): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!start) return;
    let rafId = 0;
    const startedAt = performance.now();
    const tick = (now: number): void => {
      const elapsed = now - startedAt;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [target, durationMs, start]);

  return value;
}
