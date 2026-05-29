'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { GalleryItem } from '@config/types';
import { EntityTable } from '@/components/admin/EntityTable';
import { EntityDrawer } from '@/components/admin/EntityDrawer';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import { mapActionError } from '@/components/admin/mapActionError';
import { FormField, inputClass } from '@/components/admin/form/FormField';
import { GradientPhotoPicker, type GradientPhotoValue } from '@/components/admin/form/GradientPhotoPicker';
import {
  createGalleryItemAction, updateGalleryItemAction, deleteGalleryItemAction, reorderGalleryItemsAction,
} from '@/app/(admin)/admin/entities/_actions/gallery-actions';

const formSchema = z.object({
  caption: z.string().min(1, 'Caption wajib diisi'),
  emoji: z.string().min(1, 'Emoji wajib diisi'),
  from: z.string().min(1),
  to: z.string().min(1),
  category: z.string(),
  span: z.enum(['normal', 'wide', 'tall']),
});
type FormValues = z.infer<typeof formSchema>;

export function GalleryItemManager({ initialItems }: { initialItems: GalleryItem[] }) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<GalleryItem | null>(null);
  const [deleting, setDeleting] = useState<GalleryItem | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } =
    useForm<FormValues>({ resolver: zodResolver(formSchema) });

  function openCreate() {
    setEditing(null);
    setFormError(null);
    reset({ caption: '', emoji: '📷', from: '#DBEAFE', to: '#93C5FD', category: '', span: 'normal' });
    setDrawerOpen(true);
  }

  function openEdit(g: GalleryItem) {
    setEditing(g);
    setFormError(null);
    reset({
      caption: g.caption, emoji: g.emoji, from: g.gradientFrom, to: g.gradientTo,
      category: g.category ?? '', span: g.span ?? 'normal',
    });
    setDrawerOpen(true);
  }

  function toInput(v: FormValues) {
    const base = {
      caption: v.caption, emoji: v.emoji, gradientFrom: v.from, gradientTo: v.to,
    };
    const category = v.category.trim();
    return {
      ...base,
      ...(category ? { category } : {}),
      ...(v.span !== 'normal' ? { span: v.span } : {}),
    };
  }

  function onSubmit(v: FormValues) {
    setFormError(null);
    startTransition(async () => {
      const result = editing
        ? await updateGalleryItemAction(editing.id, toInput(v))
        : await createGalleryItemAction(toInput(v));
      if (result.ok) {
        setDrawerOpen(false);
        router.refresh();
      } else {
        setFormError(mapActionError(result.error));
      }
    });
  }

  function confirmDelete() {
    if (!deleting) return;
    const id = deleting.id;
    setDeleteError(null);
    startTransition(async () => {
      const result = await deleteGalleryItemAction(id);
      if (result.ok) {
        setDeleting(null);
        router.refresh();
      } else {
        setDeleteError(mapActionError(result.error));
      }
    });
  }

  function handleReorder(ids: string[]) {
    startTransition(async () => { await reorderGalleryItemsAction(ids); });
  }

  const photoValue: GradientPhotoValue = {
    kind: 'gradient', from: watch('from') ?? '#DBEAFE', to: watch('to') ?? '#93C5FD', emoji: watch('emoji') ?? '📷',
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-extrabold text-neutral-900">Galeri</h1>
          <p className="text-sm text-neutral-600">Kelola galeri yang tampil di Beranda dan halaman Fasilitas.</p>
        </div>
      </div>

      <EntityTable<GalleryItem>
        rows={initialItems}
        getId={(g) => g.id}
        getSearchText={(g) => `${g.caption} ${g.category ?? ''}`}
        columns={[
          { header: 'Caption', cell: (g) => <span className="font-medium">{g.emoji} {g.caption}</span> },
          { header: 'Kategori', cell: (g) => g.category ?? '—' },
        ]}
        onEdit={openEdit}
        onDelete={(g) => setDeleting(g)}
        onReorder={handleReorder}
        addButton={
          <button
            type="button"
            onClick={openCreate}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
          >
            + Tambah Galeri
          </button>
        }
      />

      <EntityDrawer open={drawerOpen} title={editing ? 'Edit Galeri' : 'Tambah Galeri'} onClose={() => setDrawerOpen(false)}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Caption" htmlFor="g-caption" error={errors.caption?.message}>
            <input id="g-caption" className={inputClass} {...register('caption')} />
          </FormField>
          <FormField label="Gambar" htmlFor="g-photo" error={errors.emoji?.message}>
            <GradientPhotoPicker
              value={photoValue}
              onChange={(v) => {
                setValue('from', v.from);
                setValue('to', v.to);
                setValue('emoji', v.emoji);
              }}
            />
          </FormField>
          <FormField label="Kategori" htmlFor="g-category" hint="Opsional, mis. akademik / ekskul / fasilitas" error={errors.category?.message}>
            <input id="g-category" className={inputClass} {...register('category')} />
          </FormField>
          <FormField label="Ukuran" htmlFor="g-span" hint="Tata letak di grid" error={errors.span?.message}>
            <select id="g-span" className={inputClass} {...register('span')}>
              <option value="normal">Normal</option>
              <option value="wide">Lebar</option>
              <option value="tall">Tinggi</option>
            </select>
          </FormField>
          {formError ? <p className="text-sm text-red-600" role="alert">{formError}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setDrawerOpen(false)} className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100">
              Batal
            </button>
            <button type="submit" disabled={isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50">
              {isPending ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </form>
      </EntityDrawer>

      <DeleteConfirmDialog
        key={deleting?.id ?? 'none'}
        open={deleting !== null}
        itemName={deleting?.caption ?? ''}
        onConfirm={confirmDelete}
        onCancel={() => { setDeleting(null); setDeleteError(null); }}
        error={deleteError ?? undefined}
      />
    </div>
  );
}
