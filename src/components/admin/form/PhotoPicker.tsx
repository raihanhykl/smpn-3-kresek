'use client';

import { useRef } from 'react';
import type { Photo } from '@config/types';
import { cldUrl } from '@/lib/media/cldUrl';
import { inputClass } from './FormField';
import type { OpenImagePicker } from '@/components/admin/media/types';

/**
 * Phase 3 unified photo picker. Replaces GradientPhotoPicker for surfaces that
 * support both photo kinds (Teacher). Surfaces that are gradient-only (Gallery,
 * Facility) continue importing GradientOnlyPhotoPicker (renamed copy of the
 * original GradientPhotoPicker — see Task 6.3).
 *
 * Value shape is the existing `Photo` discriminated union exactly — the form
 * stores `photo: Photo` as a single nested field via react-hook-form's
 * Controller, removing the flat from/to/emoji/src/alt field-spaghetti from
 * the old TeacherManager.
 *
 * `value.src` for the `url` kind is a Cloudinary publicId (NOT a full URL).
 * cldUrl(value.src, 'card') renders the preview; handover = env-var swap.
 */

const PRESET_GRADIENTS: { from: string; to: string; label: string }[] = [
  { from: '#DBEAFE', to: '#93C5FD', label: 'Biru' },
  { from: '#D1FAE5', to: '#6EE7B7', label: 'Hijau' },
  { from: '#FEF9C3', to: '#FDE68A', label: 'Kuning' },
  { from: '#F3E8FF', to: '#C4B5FD', label: 'Ungu' },
  { from: '#FEE2E2', to: '#FCA5A5', label: 'Merah' },
  { from: '#FFF7ED', to: '#FED7AA', label: 'Oranye' },
];

export type PhotoPickerProps = {
  value: Photo;
  onChange: (next: Photo) => void;
  gradientDefaults?: { from: string; to: string; emoji: string };
  urlDefaults?: { src: string; alt: string };
  label?: string;
  disabled?: boolean;
  openImagePicker: OpenImagePicker;
};

const DEFAULT_GRADIENT = { from: '#DBEAFE', to: '#93C5FD', emoji: '👤' };
const DEFAULT_URL = { src: '', alt: '' };

export function PhotoPicker({
  value, onChange, gradientDefaults = DEFAULT_GRADIENT, urlDefaults = DEFAULT_URL,
  disabled = false, openImagePicker,
}: PhotoPickerProps) {
  // Remember the most recent sub-value of each kind so toggling doesn't lose work.
  const lastGradient = useRef<Photo>(
    value.kind === 'gradient' ? value : { kind: 'gradient', ...gradientDefaults },
  );
  const lastUrl = useRef<Photo>(
    value.kind === 'url' ? value : { kind: 'url', ...urlDefaults },
  );

  function switchKind(next: 'gradient' | 'url') {
    if (next === value.kind) return;
    if (value.kind === 'gradient') lastGradient.current = value;
    if (value.kind === 'url') lastUrl.current = value;
    onChange(next === 'gradient' ? lastGradient.current : lastUrl.current);
  }

  async function pickImage() {
    const picked = await openImagePicker({ kind: 'image' });
    if (!picked) return;
    onChange({
      kind: 'url',
      src: picked.publicId,
      alt: value.kind === 'url' && value.alt ? value.alt : picked.alt,
    });
  }

  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="Jenis Foto" className="inline-flex overflow-hidden rounded-md border border-neutral-300 text-sm">
        <button
          type="button" role="tab" aria-selected={value.kind === 'gradient'}
          onClick={() => switchKind('gradient')} disabled={disabled}
          className={`px-3 py-1.5 font-medium transition-colors ${value.kind === 'gradient' ? 'bg-primary text-white' : 'bg-white text-neutral-700 hover:bg-neutral-50'} disabled:opacity-50`}
        >
          Gradien &amp; Emoji
        </button>
        <button
          type="button" role="tab" aria-selected={value.kind === 'url'}
          onClick={() => switchKind('url')} disabled={disabled}
          className={`px-3 py-1.5 font-medium transition-colors ${value.kind === 'url' ? 'bg-primary text-white' : 'bg-white text-neutral-700 hover:bg-neutral-50'} disabled:opacity-50`}
        >
          Foto Upload
        </button>
      </div>

      {value.kind === 'gradient' ? (
        <GradientFields value={value} onChange={onChange} disabled={disabled} />
      ) : (
        <UrlFields
          value={value}
          onChange={onChange}
          onPick={pickImage}
          disabled={disabled}
        />
      )}
    </div>
  );
}

function GradientFields({
  value, onChange, disabled,
}: {
  value: Extract<Photo, { kind: 'gradient' }>;
  onChange: (next: Photo) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-3">
      <div
        className="flex h-24 w-24 items-center justify-center rounded-xl text-4xl"
        style={{ background: `linear-gradient(135deg, ${value.from}, ${value.to})` }}
        aria-label="Pratinjau foto"
      >
        <span aria-hidden>{value.emoji || '👤'}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {PRESET_GRADIENTS.map((g) => (
          <button
            key={g.label}
            type="button"
            disabled={disabled}
            onClick={() => onChange({ ...value, from: g.from, to: g.to })}
            className={`h-8 w-8 rounded-full border-2 disabled:opacity-50 ${
              value.from === g.from && value.to === g.to ? 'border-primary' : 'border-transparent'
            }`}
            style={{ background: `linear-gradient(135deg, ${g.from}, ${g.to})` }}
            title={g.label}
            aria-label={`Gradient ${g.label}`}
          />
        ))}
      </div>
      <input
        type="text"
        value={value.emoji}
        onChange={(e) => onChange({ ...value, emoji: e.target.value })}
        placeholder="Emoji (mis. 👩‍🏫)"
        maxLength={4}
        className={inputClass}
        aria-label="Emoji foto"
        disabled={disabled}
      />
    </div>
  );
}

function UrlFields({
  value, onChange, onPick, disabled,
}: {
  value: Extract<Photo, { kind: 'url' }>;
  onChange: (next: Photo) => void;
  onPick: () => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-3">
      {value.src ? (
        // eslint-disable-next-line @next/next/no-img-element -- admin preview only
        <img
          src={cldUrl(value.src, 'card')}
          alt={value.alt || 'Pratinjau foto'}
          className="h-32 w-32 rounded-xl object-cover"
        />
      ) : (
        <div className="flex h-32 w-32 items-center justify-center rounded-xl bg-neutral-100 text-xs text-neutral-500">
          Belum ada foto
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onPick}
          disabled={disabled}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
        >
          {value.src ? 'Ganti Foto' : 'Pilih Foto'}
        </button>
      </div>
      <input
        type="text"
        value={value.alt}
        onChange={(e) => onChange({ ...value, alt: e.target.value })}
        placeholder="Teks alternatif (mis. Pak Budi, Kepala Sekolah)"
        maxLength={300}
        className={inputClass}
        aria-label="Alt teks foto"
        disabled={disabled}
      />
    </div>
  );
}
