'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Photo, Teacher } from '@config/types';
import { photoSchema } from '@/lib/validation/schemas/shared';
import { EntityTable } from '@/components/admin/EntityTable';
import { EntityDrawer } from '@/components/admin/EntityDrawer';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import { mapActionError } from '@/components/admin/mapActionError';
import { FormField, inputClass } from '@/components/admin/form/FormField';
import { PhotoPicker } from '@/components/admin/form/PhotoPicker';
import { useImagePicker } from '@/components/admin/media/useImagePicker';
import {
  createTeacherAction, updateTeacherAction, deleteTeacherAction, reorderTeachersAction,
} from '@/app/(admin)/admin/entities/_actions/teacher-actions';

// Phase 3: form value carries `photo: Photo` as a single nested discriminated
// union (validated by the shared photoSchema). The flat from/to/emoji and
// src/alt fields are gone — Controller binds the picker directly.
const formSchema = z.object({
  name: z.string().min(1, 'Nama wajib diisi'),
  position: z.string().min(1, 'Jabatan wajib diisi'),
  badge: z.string(),
  category: z.enum(['pimpinan', 'guru', 'tu']),
  photo: photoSchema,
});
type FormValues = z.infer<typeof formSchema>;

const CATEGORY_LABEL: Record<Teacher['category'], string> = {
  pimpinan: 'Pimpinan', guru: 'Guru', tu: 'Tata Usaha',
};

const DEFAULT_GRADIENT_PHOTO: Photo = {
  kind: 'gradient', from: '#DBEAFE', to: '#93C5FD', emoji: '👤',
};

export function TeacherManager({ initialTeachers }: { initialTeachers: Teacher[] }) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [deleting, setDeleting] = useState<Teacher | null>(null);
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
      name: '', position: '', badge: '', category: 'guru',
      photo: DEFAULT_GRADIENT_PHOTO,
    });
    setDrawerOpen(true);
  }

  function openEdit(t: Teacher) {
    setEditing(t);
    setFormError(null);
    reset({
      name: t.name, position: t.position, badge: t.badge, category: t.category,
      photo: t.photo,
    });
    setDrawerOpen(true);
  }

  function toInput(v: FormValues) {
    return {
      name: v.name, position: v.position, badge: v.badge,
      category: v.category, photo: v.photo,
    };
  }

  function onSubmit(v: FormValues) {
    setFormError(null);
    startTransition(async () => {
      const result = editing
        ? await updateTeacherAction(editing.id, toInput(v))
        : await createTeacherAction(toInput(v));
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
      const result = await deleteTeacherAction(id);
      if (result.ok) {
        setDeleting(null);
        router.refresh();
      } else {
        setDeleteError(mapActionError(result.error));
      }
    });
  }

  function handleReorder(ids: string[]) {
    startTransition(async () => { await reorderTeachersAction(ids); });
  }

  // errors.photo is a union of per-branch field errors; surface the first
  // available message string so FormField can render it.
  const photoErrorMessage =
    (errors.photo as { message?: string } | undefined)?.message ??
    (errors.photo as { src?: { message?: string } } | undefined)?.src?.message ??
    (errors.photo as { alt?: { message?: string } } | undefined)?.alt?.message ??
    (errors.photo as { emoji?: { message?: string } } | undefined)?.emoji?.message;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-extrabold text-neutral-900">Guru &amp; Staf</h1>
          <p className="text-sm text-neutral-600">Kelola daftar guru dan staf yang tampil di halaman Profil.</p>
        </div>
      </div>

      <EntityTable<Teacher>
        rows={initialTeachers}
        getId={(t) => t.id}
        getSearchText={(t) => `${t.name} ${t.position}`}
        columns={[
          { header: 'Nama', cell: (t) => <span className="font-medium">{t.name}</span> },
          { header: 'Jabatan', cell: (t) => t.position },
          { header: 'Kategori', cell: (t) => CATEGORY_LABEL[t.category] },
        ]}
        onEdit={openEdit}
        onDelete={(t) => setDeleting(t)}
        onReorder={handleReorder}
        addButton={
          <button
            type="button"
            onClick={openCreate}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
          >
            + Tambah Guru
          </button>
        }
      />

      <EntityDrawer open={drawerOpen} title={editing ? 'Edit Guru' : 'Tambah Guru'} onClose={() => setDrawerOpen(false)}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Nama" htmlFor="t-name" error={errors.name?.message}>
            <input id="t-name" className={inputClass} {...register('name')} />
          </FormField>
          <FormField label="Jabatan" htmlFor="t-position" error={errors.position?.message}>
            <input id="t-position" className={inputClass} {...register('position')} />
          </FormField>
          <FormField label="Gelar / Badge" htmlFor="t-badge" hint="mis. S.Pd., M.Pd." error={errors.badge?.message}>
            <input id="t-badge" className={inputClass} {...register('badge')} />
          </FormField>
          <FormField label="Kategori" htmlFor="t-category" error={errors.category?.message}>
            <select id="t-category" className={inputClass} {...register('category')}>
              <option value="pimpinan">Pimpinan</option>
              <option value="guru">Guru</option>
              <option value="tu">Tata Usaha</option>
            </select>
          </FormField>
          <FormField label="Foto" htmlFor="t-photo" error={photoErrorMessage}>
            <Controller
              name="photo"
              control={control}
              render={({ field }) => (
                <PhotoPicker
                  value={field.value}
                  onChange={field.onChange}
                  openImagePicker={openImagePicker}
                  cropAspect={4 / 5}
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
