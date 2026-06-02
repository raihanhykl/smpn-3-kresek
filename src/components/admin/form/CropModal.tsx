'use client';

import { useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { cldUrl } from '@/lib/media/cldUrl';

/**
 * Phase 4 crop modal. Lets an admin pan + zoom an uploaded image inside a frame
 * locked to the entity's display aspect ratio, then stores a NORMALIZED crop
 * region (0–1 fractions). The original image is never modified — we persist
 * coordinates only and Cloudinary applies the crop at delivery (see cldUrl).
 *
 * react-easy-crop's onCropComplete gives `croppedArea` in PERCENT (0–100); we
 * divide by 100 to get the 0–1 fractions stored on the Photo. No canvas export,
 * no CORS dance — coordinates only.
 */

export type CropResult = { x: number; y: number; w: number; h: number };

type CropModalProps = {
  publicId: string; // Cloudinary source to crop (rendered via the 'original' variant)
  aspect: number; // locked frame ratio, e.g. 4/5
  initial?: CropResult | undefined; // existing crop (0–1) to seed the editor
  onConfirm: (crop: CropResult) => void;
  onCancel: () => void;
};

export function CropModal({ publicId, aspect, initial, onConfirm, onCancel }: CropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  // Latest percent-based area from the cropper (0–100). Seed from `initial`.
  const [areaPercent, setAreaPercent] = useState<Area | null>(
    initial
      ? { x: initial.x * 100, y: initial.y * 100, width: initial.w * 100, height: initial.h * 100 }
      : null,
  );

  const initialAreaPercentages: Area | undefined = initial
    ? { x: initial.x * 100, y: initial.y * 100, width: initial.w * 100, height: initial.h * 100 }
    : undefined;

  function handleConfirm() {
    if (!areaPercent) {
      onCancel();
      return;
    }
    onConfirm({
      x: clamp01(areaPercent.x / 100),
      y: clamp01(areaPercent.y / 100),
      w: clamp01(areaPercent.width / 100),
      h: clamp01(areaPercent.height / 100),
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Atur Posisi Foto"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-neutral-200 px-5 py-3">
          <h2 className="text-lg font-semibold">Atur Posisi Foto</h2>
          <p className="text-xs text-neutral-500">Geser &amp; perbesar agar pas di bingkai</p>
        </header>

        {/* react-easy-crop is position:absolute — it MUST have a sized,
            position:relative parent or it renders blank. */}
        <div className="relative h-[55vh] w-full bg-neutral-900">
          <Cropper
            image={cldUrl(publicId, 'original')}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(area) => setAreaPercent(area)}
            {...(initialAreaPercentages ? { initialCroppedAreaPercentages: initialAreaPercentages } : {})}
          />
        </div>

        <div className="flex items-center gap-3 border-t border-neutral-200 px-5 py-3">
          <label htmlFor="crop-zoom" className="text-sm text-neutral-600">
            Zoom
          </label>
          <input
            id="crop-zoom"
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-primary"
            aria-label="Tingkat zoom"
          />
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-neutral-300 px-4 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="rounded-md bg-primary px-4 py-1.5 text-sm font-semibold text-white hover:bg-primary/90"
          >
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
