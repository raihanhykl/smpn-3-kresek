'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Achievement, Photo } from '@config/types';
import { photoSchema } from '@/lib/validation/schemas/shared';
import { EntityTable } from '@/components/admin/EntityTable';
import { EntityDrawer } from '@/components/admin/EntityDrawer';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import { mapActionError } from '@/components/admin/mapActionError';
import { FormField, inputClass } from '@/components/admin/form/FormField';
import { PhotoPicker } from '@/components/admin/form/PhotoPicker';
import { useImagePicker } from '@/components/admin/media/useImagePicker';
import {
  createAchievementAction, updateAchievementAction, deleteAchievementAction, reorderAchievementsAction,
} from '@/app/(admin)/admin/entities/_actions/achievement-actions';

const formSchema = z.object({
  year: z.coerce.number().int().min(2000, 'Tahun tidak valid').max(2100, 'Tahun tidak valid'),
  title: z.string().min(1, 'Judul wajib diisi'),
  recipient: z.string().min(1, 'Penerima wajib diisi'),
  organizer: z.string().min(1, 'Penyelenggara wajib diisi'),
  level: z.enum(['kabupaten', 'provinsi', 'nasional', 'internasional']),
  photo: photoSchema,
});
type FormValues = z.infer<typeof formSchema>;

const LEVEL_LABEL: Record<Achievement['level'], string> = {
  kabupaten: 'Kabupaten/Kota', provinsi: 'Provinsi', nasional: 'Nasional', internasional: 'Internasional',
};

const DEFAULT_GRADIENT_PHOTO: Photo = {
  kind: 'gradient', from: '#E0F2FE', to: '#FFFFFF', emoji: '🏆',
};

export function AchievementManager({ initialAchievements }: { initialAchievements: Achievement[] }) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Achievement | null>(null);
  const [deleting, setDeleting] = useState<Achievement | null>(null);
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
      year: new Date().getFullYear(), title: '', recipient: '', organizer: '',
      level: 'kabupaten', photo: DEFAULT_GRADIENT_PHOTO,
    });
    setDrawerOpen(true);
  }

  function openEdit(a: Achievement) {
    setEditing(a);
    setFormError(null);
    reset({
      year: a.year, title: a.title, recipient: a.recipient,
      organizer: a.organizer, level: a.level, photo: a.photo,
    });
    setDrawerOpen(true);
  }

  function toInput(v: FormValues) {
    return {
      year: v.year, title: v.title, recipient: v.recipient,
      organizer: v.organizer, level: v.level, photo: v.photo,
    };
  }

  function onSubmit(v: FormValues) {
    setFormError(null);
    startTransition(async () => {
      const result = editing
        ? await updateAchievementAction(editing.id, toInput(v))
        : await createAchievementAction(toInput(v));
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
      const result = await deleteAchievementAction(id);
      if (result.ok) {
        setDeleting(null);
        router.refresh();
      } else {
        setDeleteError(mapActionError(result.error));
      }
    });
  }

  function handleReorder(ids: string[]) {
    startTransition(async () => { await reorderAchievementsAction(ids); });
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
          <h1 className="font-heading text-2xl font-extrabold text-neutral-900">Prestasi</h1>
          <p className="text-sm text-neutral-600">Kelola daftar prestasi yang tampil di Beranda dan Profil.</p>
        </div>
      </div>

      <EntityTable<Achievement>
        rows={initialAchievements}
        getId={(a) => a.id}
        getSearchText={(a) => `${a.title} ${a.recipient}`}
        columns={[
          { header: 'Tahun', cell: (a) => a.year },
          { header: 'Judul', cell: (a) => <span className="font-medium">{a.title}</span> },
          { header: 'Penerima', cell: (a) => a.recipient },
          { header: 'Tingkat', cell: (a) => LEVEL_LABEL[a.level] },
        ]}
        onEdit={openEdit}
        onDelete={(a) => setDeleting(a)}
        onReorder={handleReorder}
        addButton={
          <button
            type="button"
            onClick={openCreate}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
          >
            + Tambah Prestasi
          </button>
        }
      />

      <EntityDrawer open={drawerOpen} title={editing ? 'Edit Prestasi' : 'Tambah Prestasi'} onClose={() => setDrawerOpen(false)}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Tahun" htmlFor="a-year" error={errors.year?.message}>
            <input id="a-year" type="number" className={inputClass} {...register('year')} />
          </FormField>
          <FormField label="Judul" htmlFor="a-title" error={errors.title?.message}>
            <input id="a-title" className={inputClass} {...register('title')} />
          </FormField>
          <FormField label="Penerima" htmlFor="a-recipient" error={errors.recipient?.message}>
            <input id="a-recipient" className={inputClass} {...register('recipient')} />
          </FormField>
          <FormField label="Penyelenggara" htmlFor="a-organizer" error={errors.organizer?.message}>
            <input id="a-organizer" className={inputClass} {...register('organizer')} />
          </FormField>
          <FormField label="Tingkat" htmlFor="a-level" error={errors.level?.message}>
            <select id="a-level" className={inputClass} {...register('level')}>
              <option value="kabupaten">Kabupaten/Kota</option>
              <option value="provinsi">Provinsi</option>
              <option value="nasional">Nasional</option>
              <option value="internasional">Internasional</option>
            </select>
          </FormField>
          <FormField label="Foto / Ikon" htmlFor="a-photo" hint="Upload sertifikat atau pakai emoji 🏆" error={photoErrorMessage}>
            <Controller
              name="photo"
              control={control}
              render={({ field }) => (
                <PhotoPicker
                  value={field.value}
                  onChange={field.onChange}
                  openImagePicker={openImagePicker}
                  gradientDefaults={{ from: '#E0F2FE', to: '#FFFFFF', emoji: '🏆' }}
                  cropAspect={4 / 3}
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
        itemName={deleting?.title ?? ''}
        onConfirm={confirmDelete}
        onCancel={() => { setDeleting(null); setDeleteError(null); }}
        error={deleteError ?? undefined}
      />
    </div>
  );
}
