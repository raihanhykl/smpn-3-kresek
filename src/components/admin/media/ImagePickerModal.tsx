'use client';

import { useCallback, useEffect, useState } from 'react';
import { cldUrl } from '@/lib/media/cldUrl';
import type { ImagePickerKind, PickedMedia } from './types';
import type { PublicMediaAsset } from '@/lib/validation/schemas/media';
import { UploadButton } from './UploadButton';
import { deleteMediaAction } from '@/app/(admin)/admin/media/_actions/media-actions';
import { usageLabel } from '@/lib/media/usage-label';

/**
 * Phase 3 ImagePickerModal — modal grid of MediaAsset rows of the requested
 * kind. Users either pick one, upload a new one (Chunk 9), or cancel; the
 * parent provider resolves the Promise from useImagePicker().open(...).
 */

type ListResponse = { items: PublicMediaAsset[]; nextCursor: string | null };

type Props = {
  kind: ImagePickerKind;
  onPick: (picked: PickedMedia | null) => void;
};

export function ImagePickerModal({ kind, onPick }: Props) {
  const [items, setItems] = useState<PublicMediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadReady, setUploadReady] = useState<boolean | null>(null);
  // id -> transient delete UI state for that card
  const [cardState, setCardState] = useState<Record<string, {
    status: 'idle' | 'confirming' | 'deleting';
    usage?: string[];
    error?: string;
  }>>({});

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    return fetch(`/api/media/list?kind=${kind}&limit=50`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j: ListResponse) => setItems(j.items))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [kind]);

  useEffect(() => {
    let cancelled = false;
    void refresh();
    fetch('/api/media/status')
      .then((r) => (r.ok ? r.json() : { ready: false }))
      .then((j: { ready: boolean }) => { if (!cancelled) setUploadReady(j.ready); })
      .catch(() => { if (!cancelled) setUploadReady(false); });
    return () => { cancelled = true; };
  }, [refresh]);

  // Escape closes the modal as cancelled.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onPick(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onPick]);

  function setCard(id: string, s: { status: 'idle' | 'confirming' | 'deleting'; usage?: string[]; error?: string }) {
    setCardState((prev) => ({ ...prev, [id]: s }));
  }

  async function handleDelete(id: string) {
    setCard(id, { status: 'deleting' });
    const r = await deleteMediaAction(id);
    if (!r.ok) {
      setCard(id, { status: 'idle', error: 'Gagal menghapus. Coba lagi.' });
      return;
    }
    if (r.data.deleted) {
      await refresh(); // photo gone from grid
    } else {
      // In use — list EVERY location (one entry per usage row, no label dedupe).
      setCard(id, { status: 'idle', usage: r.data.usage.map(usageLabel) });
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pilih Foto"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onPick(null); }}
    >
      <div className="max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-lg bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-neutral-200 px-5 py-3">
          <h2 className="text-lg font-semibold">
            {kind === 'image' ? 'Pilih Foto' : 'Pilih PDF'}
          </h2>
          <div className="flex items-start gap-2">
            {uploadReady ? (
              <UploadButton
                kind={kind}
                label={kind === 'image' ? 'Unggah Foto' : 'Unggah PDF'}
                onUploaded={() => { void refresh(); }}
              />
            ) : (
              <button
                type="button"
                disabled
                title="Akan tersedia setelah kredensial Cloudinary dikonfigurasi"
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-400 disabled:cursor-not-allowed"
              >
                Unggah Baru
              </button>
            )}
            <button
              type="button"
              onClick={() => onPick(null)}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
            >
              Batal
            </button>
          </div>
        </header>

        <div className="overflow-y-auto p-5">
          {loading ? <p className="text-sm text-neutral-500">Memuat…</p> : null}
          {error ? <p className="text-sm text-red-600">Gagal memuat daftar: {error}</p> : null}
          {!loading && !error && items.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-neutral-500">Belum ada media.</p>
              <p className="mt-1 text-xs text-neutral-400">
                Upload akan aktif setelah kredensial Cloudinary dikonfigurasi.
              </p>
            </div>
          ) : null}
          {!loading && items.length > 0 ? (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {items.map((m) => (
                <li
                  key={m.id}
                  className="overflow-hidden rounded-md border border-neutral-200 bg-neutral-50"
                >
                  <div className="aspect-[4/3] w-full bg-neutral-100">
                    {m.kind === 'image' ? (
                      // eslint-disable-next-line @next/next/no-img-element -- modal preview only
                      <img
                        src={cldUrl(m.publicId, 'card')}
                        alt={m.alt ?? m.filename}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-3xl">📄</div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="truncate text-xs font-medium text-neutral-700" title={m.filename}>
                      {m.filename}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        onPick({ publicId: m.publicId, url: m.url, alt: m.alt ?? '' })
                      }
                      className="mt-1 w-full rounded-md bg-primary px-2 py-1 text-xs font-semibold text-white hover:bg-primary/90"
                    >
                      Pilih
                    </button>

                    {(() => {
                      const st = cardState[m.id] ?? { status: 'idle' as const };
                      if (st.status === 'confirming') {
                        return (
                          <div className="mt-1 flex gap-1">
                            <button type="button" onClick={() => handleDelete(m.id)} className="flex-1 rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700">Ya, hapus</button>
                            <button type="button" onClick={() => setCard(m.id, { status: 'idle' })} className="flex-1 rounded border border-neutral-300 px-2 py-1 text-xs">Batal</button>
                          </div>
                        );
                      }
                      return (
                        <button
                          type="button"
                          disabled={st.status === 'deleting'}
                          onClick={() => setCard(m.id, { status: 'confirming' })}
                          className="mt-1 w-full rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          {st.status === 'deleting' ? 'Menghapus…' : '🗑 Hapus'}
                        </button>
                      );
                    })()}

                    {cardState[m.id]?.usage ? (
                      <p className="mt-1 text-[11px] leading-snug text-amber-700">
                        Sedang dipakai di: {cardState[m.id]!.usage!.join(', ')}. Lepas dulu di sana.
                      </p>
                    ) : null}
                    {cardState[m.id]?.error ? (
                      <p className="mt-1 text-[11px] text-red-600">{cardState[m.id]!.error}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}
