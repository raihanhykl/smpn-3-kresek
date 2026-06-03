'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Photo } from '@config/types';
import { PhotoPicker } from '@/components/admin/form/PhotoPicker';
import { useImagePicker } from '@/components/admin/media/useImagePicker';
import { mapActionError } from '@/components/admin/mapActionError';
import { updatePageSectionPhotoAction } from '@/app/(admin)/admin/entities/_actions/page-section-actions';

export type SlotSnapshot = {
  pageKey: string;
  sectionKey: string;
  field: 'photo' | 'photoMain' | 'photoSub';
  label: string;
  aspect: number;
  emoji: string;
  photo: Photo | null;
};

const PAGE_GROUP_LABEL: Record<string, string> = {
  home: 'Beranda',
  profil: 'Profil',
  akademik: 'Akademik',
};

function slotKey(s: SlotSnapshot): string {
  return `${s.pageKey}:${s.sectionKey}:${s.field}`;
}

// Friendly ratio label for the known slot aspects.
function ratioLabel(aspect: number): string {
  const map: { a: number; label: string }[] = [
    { a: 16 / 9, label: '16:9' },
    { a: 4 / 3, label: '4:3' },
    { a: 1, label: '1:1' },
    { a: 4 / 5, label: '4:5' },
    { a: 5 / 6, label: '5:6' },
  ];
  const hit = map.find((m) => Math.abs(m.a - aspect) < 0.001);
  return hit ? hit.label : '';
}

export function PageSectionPhotoManager({ slots }: { slots: SlotSnapshot[] }) {
  // Group slots by page for a tidy settings-style layout.
  const groups = new Map<string, SlotSnapshot[]>();
  for (const s of slots) {
    const list = groups.get(s.pageKey) ?? [];
    list.push(s);
    groups.set(s.pageKey, list);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-extrabold text-neutral-900">Halaman &amp; Foto</h1>
        <p className="text-sm text-neutral-600">
          Ganti foto pada bagian-bagian halaman (Hero, Sambutan Kepala Sekolah, Tentang Kami, Sejarah,
          Kurikulum). Jika dibiarkan kosong, akan tampil placeholder bawaan.
        </p>
      </div>

      <div className="space-y-8">
        {[...groups.entries()].map(([pageKey, pageSlots]) => (
          <section key={pageKey}>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-neutral-500">
              {PAGE_GROUP_LABEL[pageKey] ?? pageKey}
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {pageSlots.map((s) => (
                <SlotCard key={slotKey(s)} slot={s} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function SlotCard({ slot }: { slot: SlotSnapshot }) {
  const router = useRouter();
  const { open: openImagePicker } = useImagePicker();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // The PhotoPicker value is always a Photo. Seed from the stored photo, or a
  // gradient placeholder default for this slot when none is set yet.
  const defaultGradient: Photo = {
    kind: 'gradient',
    from: '#1565C0',
    to: '#1E88E5',
    emoji: slot.emoji,
  };
  const [value, setValue] = useState<Photo>(slot.photo ?? defaultGradient);

  function onChange(next: Photo) {
    setValue(next);
    setSaved(false);
  }

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const r = await updatePageSectionPhotoAction({
        pageKey: slot.pageKey,
        sectionKey: slot.sectionKey,
        field: slot.field,
        photo: value,
      });
      if (!r.ok) {
        setError(mapActionError(r.error));
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <article className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-heading text-sm font-bold text-neutral-900">{slot.label}</h3>
        <span className="text-xs text-neutral-400">{ratioLabel(slot.aspect)}</span>
      </div>

      <PhotoPicker
        value={value}
        onChange={onChange}
        openImagePicker={openImagePicker}
        cropAspect={slot.aspect}
        gradientDefaults={{ from: '#1565C0', to: '#1E88E5', emoji: slot.emoji }}
      />

      {error ? <p className="mt-2 text-sm text-red-600" role="alert">{error}</p> : null}
      {saved ? <p className="mt-2 text-sm text-green-600">Tersimpan.</p> : null}

      <div className="mt-3">
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>
    </article>
  );
}
