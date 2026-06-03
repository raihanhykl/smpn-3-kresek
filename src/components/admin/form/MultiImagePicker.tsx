'use client';

import { cldUrl } from '@/lib/media/cldUrl';
import type { MadingImage } from '@config/types';
import type { OpenImagePicker } from '@/components/admin/media/types';
import { inputClass } from '@/components/admin/form/FormField';

type MultiImagePickerProps = {
  value: MadingImage[];
  onChange: (next: MadingImage[]) => void;
  openImagePicker: OpenImagePicker;
  disabled?: boolean;
};

export function MultiImagePicker({ value, onChange, openImagePicker, disabled }: MultiImagePickerProps) {
  // IMPORTANT: opening the picker must NOT be wrapped in startTransition by the
  // caller; this handler is a plain async click handler (React 19 defers the
  // modal mount otherwise).
  async function handleAdd() {
    const picked = await openImagePicker({ kind: 'image' });
    if (picked) {
      onChange([...value, { src: picked.publicId, alt: picked.alt }]);
    }
  }

  function updateAlt(i: number, alt: string) {
    onChange(value.map((img, j) => (j === i ? { ...img, alt } : img)));
  }

  function remove(i: number) {
    onChange(value.filter((_, j) => j !== i));
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    const a = next[i];
    const b = next[j];
    if (!a || !b) return; // noUncheckedIndexedAccess guard
    next[i] = b;
    next[j] = a;
    onChange(next);
  }

  return (
    <div className="space-y-3">
      {value.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Belum ada gambar. Posting boleh tanpa gambar (teks saja) atau tambahkan satu/lebih.
        </p>
      ) : (
        <ul className="space-y-2">
          {value.map((img, i) => (
            <li key={`${img.src}-${i}`} className="flex items-start gap-3 rounded-md border border-neutral-200 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary CDN preview */}
              <img src={cldUrl(img.src, 'avatar')} alt={img.alt} className="h-14 w-14 shrink-0 rounded object-cover" />
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-neutral-600">Alt (deskripsi gambar)</label>
                <input
                  className={inputClass}
                  value={img.alt}
                  disabled={disabled}
                  onChange={(e) => updateAlt(i, e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <button type="button" disabled={disabled || i === 0} onClick={() => move(i, -1)} className="rounded border border-neutral-300 px-2 text-sm disabled:opacity-30" aria-label="Naik">↑</button>
                <button type="button" disabled={disabled || i === value.length - 1} onClick={() => move(i, 1)} className="rounded border border-neutral-300 px-2 text-sm disabled:opacity-30" aria-label="Turun">↓</button>
                <button type="button" disabled={disabled} onClick={() => remove(i)} className="rounded border border-red-300 px-2 text-sm text-red-600 disabled:opacity-30" aria-label="Hapus">✕</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={handleAdd}
        disabled={disabled}
        className="rounded-md border border-primary px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/5 disabled:opacity-50"
      >
        ➕ Tambah Gambar
      </button>
    </div>
  );
}
