'use client';

import { useCallback, useState } from 'react';

export type AccordionMode = 'single' | 'multi';

export interface AccordionApi {
  isOpen: (id: string) => boolean;
  toggle: (id: string) => void;
}

export function useAccordion(mode: AccordionMode = 'single', initial: string[] = []): AccordionApi {
  const [open, setOpen] = useState<Set<string>>(new Set(initial));

  const toggle = useCallback(
    (id: string) => {
      setOpen((prev) => {
        const next = new Set(prev);
        if (mode === 'single') {
          if (next.has(id)) next.delete(id);
          else {
            next.clear();
            next.add(id);
          }
        } else if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    },
    [mode],
  );

  const isOpen = useCallback((id: string) => open.has(id), [open]);

  return { isOpen, toggle };
}
