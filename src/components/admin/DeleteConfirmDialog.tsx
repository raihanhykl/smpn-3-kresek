'use client';

import { useState } from 'react';
import { inputClass } from './form/FormField';

export function DeleteConfirmDialog({
  open, itemName, onConfirm, onCancel,
}: {
  open: boolean;
  itemName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState('');
  if (!open) return null;
  const matches = typed === itemName;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="font-heading text-lg font-bold text-neutral-900">Hapus &ldquo;{itemName}&rdquo;?</h2>
        <p className="mt-2 text-sm text-neutral-600">
          Tindakan ini permanen dan tidak bisa dibatalkan. Ketik nama persis untuk konfirmasi.
        </p>
        <label htmlFor="delete-confirm-input" className="mt-4 block text-sm font-medium text-neutral-800">
          Ketik nama: <span className="font-mono text-neutral-900">{itemName}</span>
        </label>
        <input
          id="delete-confirm-input"
          className={`mt-1 ${inputClass}`}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
        />
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={!matches}
            onClick={onConfirm}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            Hapus Permanen
          </button>
        </div>
      </div>
    </div>
  );
}
