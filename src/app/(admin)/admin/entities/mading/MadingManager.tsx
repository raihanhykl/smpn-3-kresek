'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Mading } from '@config/types';
import { madingImageSchema } from '@/lib/validation/schemas/entities/mading';
import { EntityTable } from '@/components/admin/EntityTable';
import { EntityDrawer } from '@/components/admin/EntityDrawer';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import { mapActionError } from '@/components/admin/mapActionError';
import { FormField, inputClass } from '@/components/admin/form/FormField';
import { MultiImagePicker } from '@/components/admin/form/MultiImagePicker';
import { useImagePicker } from '@/components/admin/media/useImagePicker';
import { cldUrl } from '@/lib/media/cldUrl';
import {
  createMadingAction, updateMadingAction, deleteMadingAction,
} from '@/app/(admin)/admin/entities/_actions/mading-actions';

const formSchema = z
  .object({
    title: z.string().min(1, 'Judul wajib diisi'),
    body: z.string(),
    images: z.array(madingImageSchema),
  })
  .superRefine((v, ctx) => {
    if (v.body.trim().length === 0 && v.images.length === 0) {
      ctx.addIssue({ code: 'custom', message: 'Isi teks atau minimal satu gambar', path: ['body'] });
    }
  });
type FormValues = z.infer<typeof formSchema>;

export function MadingManager({ initialItems }: { initialItems: Mading[] }) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Mading | null>(null);
  const [deleting, setDeleting] = useState<Mading | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { open: openImagePicker } = useImagePicker();

  const { register, handleSubmit, reset, control, formState: { errors } } =
    useForm<FormValues>({ resolver: zodResolver(formSchema) });

  function openCreate() {
    setEditing(null);
    setFormError(null);
    reset({ title: '', body: '', images: [] });
    setDrawerOpen(true);
  }

  function openEdit(m: Mading) {
    setEditing(m);
    setFormError(null);
    reset({ title: m.title, body: m.body ?? '', images: m.images });
    setDrawerOpen(true);
  }

  function toInput(v: FormValues) {
    const body = v.body.trim();
    return { title: v.title, images: v.images, ...(body ? { body } : {}) };
  }

  function onSubmit(v: FormValues) {
    setFormError(null);
    startTransition(async () => {
      const result = editing
        ? await updateMadingAction(editing.id, toInput(v))
        : await createMadingAction(toInput(v));
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
      const result = await deleteMadingAction(id);
      if (result.ok) {
        setDeleting(null);
        router.refresh();
      } else {
        setDeleteError(mapActionError(result.error));
      }
    });
  }

  const imagesErrorMessage = (errors.body as { message?: string } | undefined)?.message;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-extrabold text-neutral-900">Mading</h1>
          <p className="text-sm text-neutral-600">Kelola berita & informasi terbaru sekolah.</p>
        </div>
      </div>

      <EntityTable<Mading>
        rows={initialItems}
        getId={(m) => m.id}
        getSearchText={(m) => `${m.title} ${m.body ?? ''}`}
        columns={[
          { header: 'Judul', cell: (m) => (
            <span className="flex items-center gap-2 font-medium">
              {m.images[0] ? (
                // eslint-disable-next-line @next/next/no-img-element -- admin preview
                <img src={cldUrl(m.images[0].src, 'avatar')} alt={m.images[0].alt} className="h-8 w-8 rounded object-cover" />
              ) : (
                <span aria-hidden>📝</span>
              )}
              {m.title}
            </span>
          )},
          { header: 'Gambar', cell: (m) => (m.images.length > 0 ? `📷 ${m.images.length}` : '—') },
          { header: 'Tanggal', cell: (m) => new Date(m.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) },
        ]}
        onEdit={openEdit}
        onDelete={(m) => setDeleting(m)}
        reorderable={false}
        addButton={
          <button type="button" onClick={openCreate} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90">
            + Tambah Mading
          </button>
        }
      />

      <EntityDrawer open={drawerOpen} title={editing ? 'Edit Mading' : 'Tambah Mading'} onClose={() => setDrawerOpen(false)}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Judul" htmlFor="m-title" error={errors.title?.message}>
            <input id="m-title" className={inputClass} {...register('title')} />
          </FormField>
          <FormField label="Isi" htmlFor="m-body" hint="Opsional. Baris kosong = paragraf baru." error={errors.body?.message}>
            <textarea id="m-body" rows={6} className={inputClass} {...register('body')} />
          </FormField>
          <FormField label="Gambar" htmlFor="m-images" hint="Rasio bebas; tampil utuh di halaman detail." error={imagesErrorMessage}>
            <Controller
              name="images"
              control={control}
              render={({ field }) => (
                <MultiImagePicker
                  value={field.value}
                  onChange={field.onChange}
                  openImagePicker={openImagePicker}
                  disabled={isPending}
                />
              )}
            />
          </FormField>
          {formError ? <p className="text-sm text-red-600" role="alert">{formError}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setDrawerOpen(false)} className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100">Batal</button>
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
