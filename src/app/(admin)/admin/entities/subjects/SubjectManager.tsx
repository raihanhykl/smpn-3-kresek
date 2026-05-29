'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { AdminSubject } from '@/lib/data/repositories/subject-repo';
import { EntityTable } from '@/components/admin/EntityTable';
import { EntityDrawer } from '@/components/admin/EntityDrawer';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import { mapActionError } from '@/components/admin/mapActionError';
import { FormField, inputClass } from '@/components/admin/form/FormField';
import {
  createSubjectAction, updateSubjectAction, deleteSubjectAction, reorderSubjectsAction,
} from '@/app/(admin)/admin/entities/_actions/subject-actions';

const formSchema = z.object({
  grade: z.coerce.number().refine((n): n is 7 | 8 | 9 => n === 7 || n === 8 || n === 9, 'Kelas tidak valid'),
  groupId: z.string().min(1, 'ID kelompok wajib diisi'),
  groupTitle: z.string().min(1, 'Judul kelompok wajib diisi'),
  name: z.string().min(1, 'Nama mata pelajaran wajib diisi'),
  icon: z.string().min(1, 'Ikon wajib diisi'),
  iconBg: z.string().min(1, 'Warna ikon wajib diisi'),
  hours: z.string().min(1, 'Jam wajib diisi'),
});
type FormValues = z.infer<typeof formSchema>;

export function SubjectManager({ initialItems }: { initialItems: AdminSubject[] }) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<AdminSubject | null>(null);
  const [deleting, setDeleting] = useState<AdminSubject | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const { register, handleSubmit, reset, formState: { errors } } =
    useForm<FormValues>({ resolver: zodResolver(formSchema) });

  function openCreate() {
    setEditing(null);
    setFormError(null);
    reset({ grade: 7, groupId: '', groupTitle: '', name: '', icon: '📘', iconBg: 'bg-blue-100', hours: '2 JP' });
    setDrawerOpen(true);
  }

  function openEdit(s: AdminSubject) {
    setEditing(s);
    setFormError(null);
    reset({
      grade: s.grade, groupId: s.groupId, groupTitle: s.groupTitle,
      name: s.name, icon: s.icon, iconBg: s.iconBg, hours: s.hours,
    });
    setDrawerOpen(true);
  }

  function toInput(v: FormValues) {
    return {
      grade: v.grade, groupId: v.groupId, groupTitle: v.groupTitle,
      name: v.name, icon: v.icon, iconBg: v.iconBg, hours: v.hours,
    };
  }

  function onSubmit(v: FormValues) {
    setFormError(null);
    startTransition(async () => {
      const result = editing
        ? await updateSubjectAction(editing.id, toInput(v))
        : await createSubjectAction(toInput(v));
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
      const result = await deleteSubjectAction(id);
      if (result.ok) {
        setDeleting(null);
        router.refresh();
      } else {
        setDeleteError(mapActionError(result.error));
      }
    });
  }

  function handleReorder(ids: string[]) {
    startTransition(async () => { await reorderSubjectsAction(ids); });
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-extrabold text-neutral-900">Mata Pelajaran</h1>
          <p className="text-sm text-neutral-600">Kelola mata pelajaran per kelas yang tampil di halaman Akademik.</p>
        </div>
      </div>

      <EntityTable<AdminSubject>
        rows={initialItems}
        getId={(s) => s.id}
        getSearchText={(s) => `${s.name} ${s.groupTitle}`}
        columns={[
          { header: 'Nama', cell: (s) => <span className="font-medium">{s.icon} {s.name}</span> },
          { header: 'Kelas', cell: (s) => `Kelas ${s.grade}` },
          { header: 'Kelompok', cell: (s) => s.groupTitle },
        ]}
        onEdit={openEdit}
        onDelete={(s) => setDeleting(s)}
        onReorder={handleReorder}
        addButton={
          <button
            type="button"
            onClick={openCreate}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
          >
            + Tambah Mata Pelajaran
          </button>
        }
      />

      <EntityDrawer open={drawerOpen} title={editing ? 'Edit Mata Pelajaran' : 'Tambah Mata Pelajaran'} onClose={() => setDrawerOpen(false)}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Kelas" htmlFor="s-grade" error={errors.grade?.message}>
            <select id="s-grade" className={inputClass} {...register('grade')}>
              <option value="7">Kelas 7</option>
              <option value="8">Kelas 8</option>
              <option value="9">Kelas 9</option>
            </select>
          </FormField>
          <FormField label="ID Kelompok" htmlFor="s-groupId" hint="mis. kelompok-a (mengelompokkan mapel)" error={errors.groupId?.message}>
            <input id="s-groupId" className={inputClass} {...register('groupId')} />
          </FormField>
          <FormField label="Judul Kelompok" htmlFor="s-groupTitle" hint="mis. Kelompok A (Wajib)" error={errors.groupTitle?.message}>
            <input id="s-groupTitle" className={inputClass} {...register('groupTitle')} />
          </FormField>
          <FormField label="Nama Mata Pelajaran" htmlFor="s-name" error={errors.name?.message}>
            <input id="s-name" className={inputClass} {...register('name')} />
          </FormField>
          <FormField label="Ikon" htmlFor="s-icon" hint="Emoji, mis. 📘 🔬 🧮" error={errors.icon?.message}>
            <input id="s-icon" className={inputClass} {...register('icon')} />
          </FormField>
          <FormField label="Warna Latar Ikon" htmlFor="s-iconBg" hint="Kelas Tailwind, mis. bg-blue-100" error={errors.iconBg?.message}>
            <input id="s-iconBg" className={inputClass} {...register('iconBg')} />
          </FormField>
          <FormField label="Jam Pelajaran" htmlFor="s-hours" hint="mis. 2 JP" error={errors.hours?.message}>
            <input id="s-hours" className={inputClass} {...register('hours')} />
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
