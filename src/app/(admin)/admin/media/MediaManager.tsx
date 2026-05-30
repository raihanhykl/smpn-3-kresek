'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Role } from '@prisma/client';
import { cldUrl } from '@/lib/media/cldUrl';
import { mapActionError } from '@/components/admin/mapActionError';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import type { PublicMediaAsset } from '@/lib/validation/schemas/media';
import {
  deleteMediaAction, forceDeleteMediaAction,
} from '@/app/(admin)/admin/media/_actions/media-actions';

type ListResponse = { items: PublicMediaAsset[]; nextCursor: string | null };
type UsageRow = { usedInTable: string; usedInId: string; usedInField: string };

type FilterKind = 'all' | 'image' | 'pdf';

export function MediaManager({ role }: { role: Role }) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKind>('all');
  const [items, setItems] = useState<PublicMediaAsset[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadReady, setUploadReady] = useState<boolean | null>(null);
  const [deleting, setDeleting] = useState<PublicMediaAsset | null>(null);
  const [usageBlock, setUsageBlock] = useState<{ asset: PublicMediaAsset; usage: UsageRow[] } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [brokenIds, setBrokenIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    setItems([]);
    setCursor(null);
    try {
      const qs = filter === 'all' ? `?limit=24` : `?kind=${filter}&limit=24`;
      const res = await fetch(`/api/media/list${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j: ListResponse = await res.json();
      setItems(j.items);
      setCursor(j.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { void loadFirstPage(); }, [loadFirstPage]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/media/status')
      .then((r) => (r.ok ? r.json() : { ready: false }))
      .then((j: { ready: boolean }) => { if (!cancelled) setUploadReady(j.ready); })
      .catch(() => { if (!cancelled) setUploadReady(false); });
    return () => { cancelled = true; };
  }, []);

  async function loadMore() {
    if (!cursor) return;
    setLoading(true);
    try {
      const qs = filter === 'all'
        ? `?limit=24&cursor=${cursor}`
        : `?kind=${filter}&limit=24&cursor=${cursor}`;
      const res = await fetch(`/api/media/list${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j: ListResponse = await res.json();
      setItems((prev) => [...prev, ...j.items]);
      setCursor(j.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown');
    } finally {
      setLoading(false);
    }
  }

  function startDelete(asset: PublicMediaAsset) {
    setDeleting(asset);
    setDeleteError(null);
  }

  function confirmDelete() {
    if (!deleting) return;
    const id = deleting.id;
    setDeleteError(null);
    startTransition(async () => {
      const r = await deleteMediaAction(id);
      if (!r.ok) {
        setDeleteError(mapActionError(r.error));
        return;
      }
      if (r.data.deleted) {
        setItems((prev) => prev.filter((m) => m.id !== id));
        setDeleting(null);
        router.refresh();
      } else {
        // Blocked by usage — switch the dialog to the usage list view.
        setUsageBlock({ asset: deleting, usage: r.data.usage });
        setDeleting(null);
      }
    });
  }

  function confirmForceDelete(asset: PublicMediaAsset) {
    startTransition(async () => {
      const r = await forceDeleteMediaAction(asset.id);
      if (!r.ok) {
        setDeleteError(mapActionError(r.error));
        return;
      }
      setItems((prev) => prev.filter((m) => m.id !== asset.id));
      setBrokenIds((prev) => {
        const next = new Set(prev);
        next.delete(asset.id);
        return next;
      });
      router.refresh();
    });
  }

  function markBroken(id: string) {
    setBrokenIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-heading text-2xl font-extrabold text-neutral-900">Media</h1>
          <p className="text-sm text-neutral-600">Pustaka foto dan PDF. Berkas dipakai di seluruh website.</p>
        </div>
        <button
          type="button"
          disabled={!uploadReady}
          title={uploadReady ? undefined : 'Akan tersedia setelah kredensial Cloudinary dikonfigurasi'}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Unggah Baru
        </button>
      </div>

      <div className="mb-3 flex gap-2">
        {(['all', 'image', 'pdf'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === k
                ? 'border-primary bg-primary text-white'
                : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100'
            }`}
          >
            {k === 'all' ? 'Semua' : k === 'image' ? 'Foto' : 'PDF'}
          </button>
        ))}
      </div>

      {error ? <p className="mb-3 text-sm text-red-600">Gagal memuat: {error}</p> : null}

      {items.length === 0 && !loading ? (
        <div className="rounded-md border border-dashed border-neutral-300 p-12 text-center">
          <p className="text-sm text-neutral-500">Belum ada media.</p>
        </div>
      ) : null}

      {items.length > 0 ? (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {items.map((m) => {
            const broken = brokenIds.has(m.id);
            return (
              <li key={m.id} className="overflow-hidden rounded-md border border-neutral-200 bg-white">
                <div className="relative aspect-[4/3] w-full bg-neutral-100">
                  {broken ? (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-xs text-red-700">
                      <span>⚠️</span>
                      <span className="font-medium">Berkas hilang di penyimpanan</span>
                    </div>
                  ) : m.kind === 'image' ? (
                    // eslint-disable-next-line @next/next/no-img-element -- admin grid preview
                    <img
                      src={cldUrl(m.publicId, 'card')}
                      alt={m.alt ?? m.filename}
                      className="h-full w-full object-cover"
                      onError={() => markBroken(m.id)}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-4xl">📄</div>
                  )}
                </div>
                <div className="p-2">
                  <p className="truncate text-xs font-medium text-neutral-700" title={m.filename}>
                    {m.filename}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                    {m.kind === 'image' ? 'Foto' : 'PDF'} · {Math.ceil(m.sizeBytes / 1024)} KB
                  </p>
                  <div className="mt-1 flex gap-1">
                    {broken ? (
                      role === 'ADMIN' ? (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => confirmForceDelete(m)}
                          className="w-full rounded-md bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          Hapus catatan
                        </button>
                      ) : null
                    ) : (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => startDelete(m)}
                        className="w-full rounded-md border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
                      >
                        Hapus
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {cursor ? (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            disabled={loading}
            onClick={loadMore}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
          >
            {loading ? 'Memuat…' : 'Muat lebih banyak'}
          </button>
        </div>
      ) : null}

      <DeleteConfirmDialog
        key={deleting?.id ?? 'none'}
        open={deleting !== null}
        itemName={deleting?.filename ?? ''}
        onConfirm={confirmDelete}
        onCancel={() => { setDeleting(null); setDeleteError(null); }}
        error={deleteError ?? undefined}
      />

      {usageBlock !== null ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Berkas masih dipakai"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setUsageBlock(null); }}
        >
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-neutral-900">Berkas masih dipakai</h2>
            <p className="mt-1 text-sm text-neutral-600">
              <strong>{usageBlock.asset.filename}</strong> dipakai di {usageBlock.usage.length} tempat.
              Lepas penggunaannya dulu sebelum menghapus berkas ini.
            </p>
            <ul className="mt-3 max-h-48 list-disc overflow-y-auto pl-5 text-sm text-neutral-700">
              {usageBlock.usage.map((u, i) => (
                <li key={i}>
                  {u.usedInTable} <code className="text-xs text-neutral-500">#{u.usedInId}</code> / {u.usedInField}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setUsageBlock(null)}
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
