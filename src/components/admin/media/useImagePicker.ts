'use client';

import { useContext } from 'react';
import { ImagePickerContext } from './ImagePickerProvider';
import type { OpenImagePicker } from './types';

/**
 * Returns the Promise-based image-picker opener mounted at the admin layout.
 *
 * If called outside the provider, returns a no-op opener that resolves to null
 * so calling code never crashes during isolated unit-test renders. Tests that
 * want to assert pick behavior should wrap in <ImagePickerProvider/> instead.
 */
export function useImagePicker(): { open: OpenImagePicker } {
  const open = useContext(ImagePickerContext);
  return {
    open: open ?? (async () => null),
  };
}
