'use client';

import { useRef, useState } from 'react';
import type { PublicMediaAsset } from '@/lib/validation/schemas/media';
import { MEDIA_LIMITS, type MediaKind } from '@/lib/media/limits';
import { uploadToCloudinary, UploadError } from './uploadToCloudinary';
import { uploadErrorMessage } from './upload-errors';

/**
 * Hidden <input type=file> + a styled button. On selection, runs
 * uploadToCloudinary and calls onUploaded with the resulting MediaAsset.
 * Errors surface as an inline message keyed off uploadErrorMessage().
 */
export function UploadButton({
  kind, onUploaded, disabled = false, label, className,
}: {
  kind: MediaKind;
  onUploaded: (media: PublicMediaAsset) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const limits = MEDIA_LIMITS[kind];
  const accept = limits.mimes.join(',');
  const buttonLabel = label ?? (kind === 'image' ? 'Unggah Foto' : 'Unggah PDF');

  async function onFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const media = await uploadToCloudinary(file, kind);
      onUploaded(media);
    } catch (err) {
      const code = err instanceof UploadError ? err.code : 'network_error';
      setError(uploadErrorMessage(code));
    } finally {
      setBusy(false);
      // Allow re-uploading the same file by resetting the input value.
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
        }}
        aria-label={buttonLabel}
        disabled={disabled || busy}
      />
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? 'Mengunggah…' : buttonLabel}
      </button>
      {error ? <p className="mt-1 text-xs text-red-600" role="alert">{error}</p> : null}
    </div>
  );
}
