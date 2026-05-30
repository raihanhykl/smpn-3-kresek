'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { EntityTable } from '@/components/admin/EntityTable';
import { EntityDrawer } from '@/components/admin/EntityDrawer';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import { mapActionError } from '@/components/admin/mapActionError';
import { FormField, inputClass } from '@/components/admin/form/FormField';
import { GradientOnlyPhotoPicker, type GradientOnlyPhotoValue } from '@/components/admin/form/GradientOnlyPhotoPicker';
import {
  createFacilityAction, updateFacilityAction, deleteFacilityAction, reorderFacilitiesAction,
} from '@/app/(admin)/admin/entities/_actions/facility-actions';
import type { AdminFacility } from '@/lib/data/repositories/facility-repo';

// One flat form covering both kinds; the kind select drives which fields are
// required. We validate the active branch via superRefine so RHF surfaces the
// correct errors without a discriminated-union resolver (which can't switch
// fields mid-form cleanly).
const formSchema = z.object({
  kind: z.enum(['featured', 'mini']),
  name: z.string().min(1, 'Nama wajib diisi'),
  // featured-only
  description: z.string(),
  emoji: z.string(),
  from: z.string(),
  to: z.string(),
  span: z.enum(['normal', 'wide', 'tall']),
  // mini-only
  icon: z.string(),
}).superRefine((v, ctx) => {
  if (v.kind === 'featured') {
    if (!v.description.trim()) ctx.addIssue({ code: 'custom', message: 'Deskripsi wajib diisi', path: ['description'] });
    if (!v.emoji.trim()) ctx.addIssue({ code: 'custom', message: 'Emoji wajib diisi', path: ['emoji'] });
  } else {
    if (!v.icon.trim()) ctx.addIssue({ code: 'custom', message: 'Ikon wajib diisi', path: ['icon'] });
  }
});
type FormValues = z.infer<typeof formSchema>;

const KIND_LABEL = { featured: 'Unggulan', mini: 'Ringkas' } as const;

export function FacilityManager({ initialItems }: { initialItems: AdminFacility[] }) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<AdminFacility | null>(null);
  const [deleting, setDeleting] = useState<AdminFacility | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } =
    useForm<FormValues>({ resolver: zodResolver(formSchema) });

  const kind = watch('kind');

  function openCreate() {
    setEditing(null);
    setFormError(null);
    reset({ kind: 'featured', name: '', description: '', emoji: '🏫', from: '#DBEAFE', to: '#93C5FD', span: 'normal', icon: '🏫' });
    setDrawerOpen(true);
  }

  function openEdit(f: AdminFacility) {
    setEditing(f);
    setFormError(null);
    if (f.kind === 'featured') {
      reset({
        kind: 'featured', name: f.name, description: f.description, emoji: f.emoji,
        from: f.gradientFrom, to: f.gradientTo, span: f.span ?? 'normal', icon: '🏫',
      });
    } else {
      reset({
        kind: 'mini', name: f.name, icon: f.icon,
        description: '', emoji: '🏫', from: '#DBEAFE', to: '#93C5FD', span: 'normal',
      });
    }
    setDrawerOpen(true);
  }

  function toInput(v: FormValues) {
    if (v.kind === 'featured') {
      return {
        kind: 'featured' as const, name: v.name, description: v.description.trim(),
        emoji: v.emoji, gradientFrom: v.from, gradientTo: v.to,
        ...(v.span !== 'normal' ? { span: v.span } : {}),
      };
    }
    return { kind: 'mini' as const, name: v.name, icon: v.icon };
  }

  function onSubmit(v: FormValues) {
    setFormError(null);
    startTransition(async () => {
      const result = editing
        ? await updateFacilityAction(editing.id, toInput(v))
        : await createFacilityAction(toInput(v));
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
      const result = await deleteFacilityAction(id);
      if (result.ok) {
        setDeleting(null);
        router.refresh();
      } else {
        setDeleteError(mapActionError(result.error));
      }
    });
  }

  function handleReorder(ids: string[]) {
    startTransition(async () => { await reorderFacilitiesAction(ids); });
  }

  const photoValue: GradientOnlyPhotoValue = {
    kind: 'gradient', from: watch('from') ?? '#DBEAFE', to: watch('to') ?? '#93C5FD', emoji: watch('emoji') ?? '🏫',
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-extrabold text-neutral-900">Fasilitas</h1>
          <p className="text-sm text-neutral-600">Kelola fasilitas sekolah yang tampil di halaman Fasilitas.</p>
        </div>
      </div>

      <EntityTable<AdminFacility>
        rows={initialItems}
        getId={(f) => f.id}
        getSearchText={(f) => f.name}
        columns={[
          { header: 'Nama', cell: (f) => <span className="font-medium">{f.name}</span> },
          { header: 'Tipe', cell: (f) => KIND_LABEL[f.kind] },
        ]}
        onEdit={openEdit}
        onDelete={(f) => setDeleting(f)}
        onReorder={handleReorder}
        addButton={
          <button
            type="button"
            onClick={openCreate}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
          >
            + Tambah Fasilitas
          </button>
        }
      />

      <EntityDrawer open={drawerOpen} title={editing ? 'Edit Fasilitas' : 'Tambah Fasilitas'} onClose={() => setDrawerOpen(false)}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Tipe" htmlFor="fc-kind" hint="Unggulan = kartu besar; Ringkas = daftar ikon" error={errors.kind?.message}>
            <select id="fc-kind" className={inputClass} {...register('kind')}>
              <option value="featured">Unggulan</option>
              <option value="mini">Ringkas</option>
            </select>
          </FormField>
          <FormField label="Nama" htmlFor="fc-name" error={errors.name?.message}>
            <input id="fc-name" className={inputClass} {...register('name')} />
          </FormField>

          {kind === 'featured' ? (
            <>
              <FormField label="Deskripsi" htmlFor="fc-description" error={errors.description?.message}>
                <textarea id="fc-description" rows={3} className={inputClass} {...register('description')} />
              </FormField>
              <FormField label="Gambar" htmlFor="fc-photo" error={errors.emoji?.message}>
                <GradientOnlyPhotoPicker
                  value={photoValue}
                  onChange={(val) => {
                    setValue('from', val.from);
                    setValue('to', val.to);
                    setValue('emoji', val.emoji);
                  }}
                />
              </FormField>
              <FormField label="Ukuran" htmlFor="fc-span" hint="Tata letak di grid" error={errors.span?.message}>
                <select id="fc-span" className={inputClass} {...register('span')}>
                  <option value="normal">Normal</option>
                  <option value="wide">Lebar</option>
                  <option value="tall">Tinggi</option>
                </select>
              </FormField>
            </>
          ) : (
            <FormField label="Ikon" htmlFor="fc-icon" hint="Emoji, mis. 📚 🔬 ⚽" error={errors.icon?.message}>
              <input id="fc-icon" className={inputClass} {...register('icon')} />
            </FormField>
          )}

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
