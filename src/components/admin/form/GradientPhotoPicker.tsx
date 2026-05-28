'use client';

import { inputClass } from './FormField';

export type GradientPhotoValue = { kind: 'gradient'; from: string; to: string; emoji: string };

const PRESET_GRADIENTS: { from: string; to: string; label: string }[] = [
  { from: '#DBEAFE', to: '#93C5FD', label: 'Biru' },
  { from: '#D1FAE5', to: '#6EE7B7', label: 'Hijau' },
  { from: '#FEF9C3', to: '#FDE68A', label: 'Kuning' },
  { from: '#F3E8FF', to: '#C4B5FD', label: 'Ungu' },
  { from: '#FEE2E2', to: '#FCA5A5', label: 'Merah' },
  { from: '#FFF7ED', to: '#FED7AA', label: 'Oranye' },
];

export function GradientPhotoPicker({
  value, onChange,
}: {
  value: GradientPhotoValue;
  onChange: (v: GradientPhotoValue) => void;
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
            onClick={() => onChange({ ...value, from: g.from, to: g.to })}
            className={`h-8 w-8 rounded-full border-2 ${
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
      />
      <p className="text-xs text-neutral-500">
        Upload foto asli akan tersedia di update berikutnya. Untuk sekarang, pilih warna + emoji.
      </p>
    </div>
  );
}
