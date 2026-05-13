'use client';

import { useCallback, useEffect, useState } from 'react';

export interface UseCarouselArgs {
  length: number;
  autoplayMs?: number;
}

export interface CarouselApi {
  index: number;
  next: () => void;
  prev: () => void;
  goTo: (i: number) => void;
}

export function useCarousel({ length, autoplayMs }: UseCarouselArgs): CarouselApi {
  const [index, setIndex] = useState(0);

  const next = useCallback(() => {
    setIndex((i) => (length === 0 ? 0 : (i + 1) % length));
  }, [length]);
  const prev = useCallback(() => {
    setIndex((i) => (length === 0 ? 0 : (i - 1 + length) % length));
  }, [length]);
  const goTo = useCallback(
    (i: number) => {
      if (i >= 0 && i < length) setIndex(i);
    },
    [length],
  );

  useEffect(() => {
    if (!autoplayMs || length <= 1) return;
    const id = window.setInterval(next, autoplayMs);
    return () => window.clearInterval(id);
  }, [autoplayMs, length, next]);

  return { index, next, prev, goTo };
}
