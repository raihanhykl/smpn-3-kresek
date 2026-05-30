'use client';

import { createContext, useCallback, useEffect, useRef, useState } from 'react';
import type {
  ImagePickerKind, OpenImagePickerOpts, PickedMedia,
} from './types';
import { ImagePickerModal } from './ImagePickerModal';

/**
 * Phase 3 ImagePicker provider — mounts a single modal at the admin layout level
 * so it survives entity-drawer open/close cycles. Forms call `useImagePicker()`
 * to get a Promise-based `open(opts)` API.
 *
 * Promise-dangle protection (R1 blocker fix): the modal stores its resolver in
 * a ref. If the provider unmounts mid-open, the cleanup effect resolves the
 * outstanding promise with `null` so awaiting forms never hang.
 */

type OpenState = {
  kind: ImagePickerKind;
  resolver: (m: PickedMedia | null) => void;
};

type OpenFn = (opts?: OpenImagePickerOpts) => Promise<PickedMedia | null>;

export const ImagePickerContext = createContext<OpenFn | null>(null);

export function ImagePickerProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState<OpenState | null>(null);
  // Mirror of `open?.resolver` so the unmount-cleanup effect can settle the
  // dangling promise without depending on stale state.
  const resolverRef = useRef<((m: PickedMedia | null) => void) | null>(null);

  const openPicker = useCallback<OpenFn>((opts) => {
    return new Promise<PickedMedia | null>((resolve) => {
      // If another open is still active, resolve it as cancelled before starting.
      resolverRef.current?.(null);
      resolverRef.current = resolve;
      setOpen({ kind: opts?.kind ?? 'image', resolver: resolve });
    });
  }, []);

  const handlePick = useCallback((picked: PickedMedia | null) => {
    const r = resolverRef.current;
    resolverRef.current = null;
    setOpen(null);
    if (r) r(picked);
  }, []);

  // Unmount cleanup: settle any in-flight promise so awaiters don't hang.
  useEffect(() => {
    return () => {
      const r = resolverRef.current;
      resolverRef.current = null;
      if (r) r(null);
    };
  }, []);

  return (
    <ImagePickerContext.Provider value={openPicker}>
      {children}
      {open !== null ? (
        <ImagePickerModal kind={open.kind} onPick={handlePick} />
      ) : null}
    </ImagePickerContext.Provider>
  );
}
