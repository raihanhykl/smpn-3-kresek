'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { mapActionError } from '@/components/admin/mapActionError';
import { useImagePicker } from '@/components/admin/media/useImagePicker';
import { updateDocumentSlotAction } from '@/app/(admin)/admin/entities/_actions/document-slot-actions';
import { DOCUMENT_SLOT_IDS, DOCUMENT_SLOT_LABEL, DOCUMENT_SLOT_DESCRIPTION, type DocumentSlotId } from '@config/document-slots';
import { cldUrl } from '@/lib/media/cldUrl';

export type SlotSnapshot = {
  id: DocumentSlotId;
  media: {
    id: string;
    publicId: string;
    filename: string;
    sizeBytes: number;
  } | null;
};

export function DocumentSlotManager({ slots }: { slots: SlotSnapshot[] }) {
  const router = useRouter();
  const { open: openImagePicker } = useImagePicker();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const slotMap = new Map(slots.map((s) => [s.id, s]));

  function setError(slotId: DocumentSlotId, msg: string | null) {
    setErrors((prev) => ({ ...prev, [slotId]: msg }));
  }

  function attach(slotId: DocumentSlotId) {
    setError(slotId, null);
    startTransition(async () => {
      // The image picker returns the public projection (publicId/url/alt).
      // The DocumentSlot FK is on MediaAsset.id, so we resolve the picker's
      // publicId back to the row's id via /api/media/list (the picker already
      // fetched this list internally — a Phase 5 refactor can plumb id through
      // PickedMedia to avoid this extra round-trip).
      const picked = await openImagePicker({ kind: 'pdf' });
      if (!picked) return;
      const list = await fetch(`/api/media/list?kind=pdf&limit=50`).then((res) => res.json());
      const match = (list.items as Array<{ id: string; publicId: string }>).find(
        (m) => m.publicId === picked.publicId,
      );
      if (!match) {
        setError(slotId, 'Berkas tidak ditemukan di pustaka. Coba muat ulang halaman.');
        return;
      }
      const r = await updateDocumentSlotAction({ slotId, mediaId: match.id });
      if (!r.ok) {
        setError(slotId, mapActionError(r.error));
        return;
      }
      router.refresh();
    });
  }

  function detach(slotId: DocumentSlotId) {
    setError(slotId, null);
    startTransition(async () => {
      const r = await updateDocumentSlotAction({ slotId, mediaId: null });
      if (!r.ok) {
        setError(slotId, mapActionError(r.error));
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-3">
        <h1 className="font-heading text-2xl font-extrabold text-neutral-900">Dokumen PDF</h1>
        <p className="text-sm text-neutral-600">
          Pasangkan berkas PDF ke slot bawaan. Saat slot kosong, tombol unduh di halaman publik
          akan otomatis disembunyikan.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {DOCUMENT_SLOT_IDS.map((slotId) => {
          const slot = slotMap.get(slotId) ?? null;
          const media = slot?.media ?? null;
          const err = errors[slotId] ?? null;
          return (
            <article
              key={slotId}
              className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
            >
              <h2 className="font-heading text-base font-bold text-neutral-900">
                {DOCUMENT_SLOT_LABEL[slotId]}
              </h2>
              <p className="mt-1 text-xs text-neutral-500">
                {DOCUMENT_SLOT_DESCRIPTION[slotId]}
              </p>

              <div className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                {media ? (
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">📄</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-neutral-800" title={media.filename}>
                        {media.filename}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {Math.ceil(media.sizeBytes / 1024)} KB
                      </p>
                      <a
                        href={cldUrl(media.publicId, 'pdf')}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-xs font-medium text-primary hover:underline"
                      >
                        Buka berkas
                      </a>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500">Belum ada PDF terpasang.</p>
                )}
              </div>

              {err ? <p className="mt-2 text-sm text-red-600" role="alert">{err}</p> : null}

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => attach(slotId)}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {media ? 'Ganti PDF' : 'Pilih PDF'}
                </button>
                {media ? (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => detach(slotId)}
                    className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
                  >
                    Lepas PDF
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
