'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Extracurricular, Photo } from '@config/types';
import { photoSchema } from '@/lib/validation/schemas/shared';
import { EntityTable } from '@/components/admin/EntityTable';
import { EntityDrawer } from '@/components/admin/EntityDrawer';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import { mapActionError } from '@/components/admin/mapActionError';
import { FormField, inputClass } from '@/components/admin/form/FormField';
import { PhotoPicker } from '@/components/admin/form/PhotoPicker';
import { useImagePicker } from '@/components/admin/media/useImagePicker';
import {
  createExtracurricularAction, updateExtracurricularAction, deleteExtracurricularAction, reorderExtracurricularsAction,
} from '@/app/(admin)/admin/entities/_actions/extracurricular-actions';

const formSchema = z.object({
  name: z.string().min(1, 'Nama wajib diisi'),
  category: z.enum(['wajib', 'olahraga', 'seni', 'akademik', 'keagamaan', 'lainnya']),
  description: z.string(),
  pembina: z.string(),
  schedule: z.string(),
  achievement: z.string(),
  photo: photoSchema,
});
type FormValues = z.infer<typeof formSchema>;

const CATEGORY_LABEL: Record<Extracurricular['category'], string> = {
  wajib: 'Wajib', olahraga: 'Olahraga', seni: 'Seni',
  akademik: 'Akademik', keagamaan: 'Keagamaan', lainnya: 'Lainnya',
};

const DEFAULT_GRADIENT_PHOTO: Photo = {
  kind: 'gradient', from: '#F1F5F9', to: '#CBD5E1', emoji: '⭐',
};

export function ExtracurricularManager({ initialItems }: { initialItems: Extracurricular[] }) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Extracurricular | null>(null);
  const [deleting, setDeleting] = useState<Extracurricular | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { open: openImagePicker } = useImagePicker();

  const { register, handleSubmit, reset, control, formState: { errors } } =
    useForm<FormValues>({ resolver: zodResolver(formSchema) });

  function openCreate() {
    setEditing(null);
    setFormError(null);
    reset({
      name: '', category: 'wajib', description: '', pembina: '', schedule: '',
      achievement: '', photo: DEFAULT_GRADIENT_PHOTO,
    });
    setDrawerOpen(true);
  }

  function openEdit(e: Extracurricular) {
    setEditing(e);
    setFormError(null);
    reset({
      name: e.name, category: e.category, description: e.description,
      pembina: e.pembina, schedule: e.schedule, achievement: e.achievement ?? '',
      photo: e.photo,
    });
    setDrawerOpen(true);
  }

  function toInput(v: FormValues) {
    const base = {
      name: v.name, category: v.category, description: v.description,
      pembina: v.pembina, schedule: v.schedule, photo: v.photo,
    };
    const trimmed = v.achievement.trim();
    return trimmed ? { ...base, achievement: trimmed } : base;
  }

  function onSubmit(v: FormValues) {
    setFormError(null);
    startTransition(async () => {
      const result = editing
        ? await updateExtracurricularAction(editing.id, toInput(v))
        : await createExtracurricularAction(toInput(v));
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
      const result = await deleteExtracurricularAction(id);
      if (result.ok) {
        setDeleting(null);
        router.refresh();
      } else {
        setDeleteError(mapActionError(result.error));
      }
    });
  }

  function handleReorder(ids: string[]) {
    startTransition(async () => { await reorderExtracurricularsAction(ids); });
  }

  const photoErrorMessage =
    (errors.photo as { message?: string } | undefined)?.message ??
    (errors.photo as { src?: { message?: string } } | undefined)?.src?.message ??
    (errors.photo as { alt?: { message?: string } } | undefined)?.alt?.message ??
    (errors.photo as { emoji?: { message?: string } } | undefined)?.emoji?.message;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-extrabold text-neutral-900">Ekstrakurikuler</h1>
          <p className="text-sm text-neutral-600">Kelola daftar ekstrakurikuler yang tampil di halaman Fasilitas.</p>
        </div>
      </div>

      <EntityTable<Extracurricular>
        rows={initialItems}
        getId={(e) => e.id}
        getSearchText={(e) => `${e.name} ${e.pembina}`}
        columns={[
          { header: 'Nama', cell: (e) => <span className="font-medium">{e.name}</span> },
          { header: 'Kategori', cell: (e) => CATEGORY_LABEL[e.category] },
          { header: 'Pembina', cell: (e) => e.pembina },
        ]}
        onEdit={openEdit}
        onDelete={(e) => setDeleting(e)}
        onReorder={handleReorder}
        addButton={
          <button
            type="button"
            onClick={openCreate}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
          >
            + Tambah Ekstrakurikuler
          </button>
        }
      />

      <EntityDrawer open={drawerOpen} title={editing ? 'Edit Ekstrakurikuler' : 'Tambah Ekstrakurikuler'} onClose={() => setDrawerOpen(false)}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Nama" htmlFor="e-name" error={errors.name?.message}>
            <input id="e-name" className={inputClass} {...register('name')} />
          </FormField>
          <FormField label="Kategori" htmlFor="e-category" error={errors.category?.message}>
            <select id="e-category" className={inputClass} {...register('category')}>
              <option value="wajib">Wajib</option>
              <option value="olahraga">Olahraga</option>
              <option value="seni">Seni</option>
              <option value="akademik">Akademik</option>
              <option value="keagamaan">Keagamaan</option>
              <option value="lainnya">Lainnya</option>
            </select>
          </FormField>
          <FormField label="Deskripsi" htmlFor="e-description" error={errors.description?.message}>
            <textarea id="e-description" rows={3} className={inputClass} {...register('description')} />
          </FormField>
          <FormField label="Pembina" htmlFor="e-pembina" error={errors.pembina?.message}>
            <input id="e-pembina" className={inputClass} {...register('pembina')} />
          </FormField>
          <FormField label="Jadwal" htmlFor="e-schedule" hint="mis. Sabtu, 08.00" error={errors.schedule?.message}>
            <input id="e-schedule" className={inputClass} {...register('schedule')} />
          </FormField>
          <FormField label="Prestasi" htmlFor="e-achievement" hint="Opsional" error={errors.achievement?.message}>
            <input id="e-achievement" className={inputClass} {...register('achievement')} />
          </FormField>
          <FormField label="Foto / Ikon" htmlFor="e-photo" error={photoErrorMessage}>
            <Controller
              name="photo"
              control={control}
              render={({ field }) => (
                <PhotoPicker
                  value={field.value}
                  onChange={field.onChange}
                  openImagePicker={openImagePicker}
                  gradientDefaults={{ from: '#F1F5F9', to: '#CBD5E1', emoji: '⭐' }}
                />
              )}
            />
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
        itemName={deleting?.name ?? ''}
        onConfirm={confirmDelete}
        onCancel={() => { setDeleting(null); setDeleteError(null); }}
        error={deleteError ?? undefined}
      />
    </div>
  );
}
