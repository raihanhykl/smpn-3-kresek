'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { AdminSubject } from '@/lib/data/repositories/subject-repo';
import { GRADES, SUBJECT_GROUPS, SUBJECT_GROUP_LABEL, type SubjectGroupKey } from '@config/subject-groups';
import { EntityTable } from '@/components/admin/EntityTable';
import { EntityDrawer } from '@/components/admin/EntityDrawer';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import { mapActionError } from '@/components/admin/mapActionError';
import { FormField, inputClass } from '@/components/admin/form/FormField';
import {
  createSubjectAction, updateSubjectAction, deleteSubjectAction, reorderSubjectsAction,
} from '@/app/(admin)/admin/entities/_actions/subject-actions';

// Each grade has an enabled flag + a JP string; at least one grade must be enabled.
const gradeField = z.object({ enabled: z.boolean(), hours: z.string() });
const formSchema = z.object({
  group: z.enum(['wajib', 'pengembangan']),
  name: z.string().min(1, 'Nama mata pelajaran wajib diisi'),
  icon: z.string().min(1, 'Ikon wajib diisi'),
  iconBg: z.string().min(1, 'Warna ikon wajib diisi'),
  g7: gradeField, g8: gradeField, g9: gradeField,
}).superRefine((v, ctx) => {
  const enabled = [v.g7, v.g8, v.g9].filter((g) => g.enabled);
  if (enabled.length === 0) {
    ctx.addIssue({ code: 'custom', message: 'Pilih minimal satu kelas', path: ['g7'] });
  }
  ([['g7', v.g7], ['g8', v.g8], ['g9', v.g9]] as const).forEach(([key, g]) => {
    if (g.enabled && !g.hours.trim()) {
      ctx.addIssue({ code: 'custom', message: 'JP wajib diisi untuk kelas yang dipilih', path: [key, 'hours'] });
    }
  });
});
type FormValues = z.infer<typeof formSchema>;

const GRADE_KEYS = { 7: 'g7', 8: 'g8', 9: 'g9' } as const;

export function SubjectManager({ initialItems }: { initialItems: AdminSubject[] }) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<AdminSubject | null>(null);
  const [deleting, setDeleting] = useState<AdminSubject | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const { register, handleSubmit, reset, watch, formState: { errors } } =
    useForm<FormValues>({ resolver: zodResolver(formSchema) });

  function openCreate() {
    setEditing(null);
    setFormError(null);
    reset({
      group: 'wajib', name: '', icon: '📘', iconBg: '#DBEAFE',
      g7: { enabled: true, hours: '2 JP/minggu' },
      g8: { enabled: false, hours: '' },
      g9: { enabled: false, hours: '' },
    });
    setDrawerOpen(true);
  }

  function openEdit(s: AdminSubject) {
    setEditing(s);
    setFormError(null);
    const h = s.hoursByGrade;
    reset({
      group: s.group, name: s.name, icon: s.icon, iconBg: s.iconBg,
      g7: { enabled: h['7'] !== undefined, hours: h['7'] ?? '' },
      g8: { enabled: h['8'] !== undefined, hours: h['8'] ?? '' },
      g9: { enabled: h['9'] !== undefined, hours: h['9'] ?? '' },
    });
    setDrawerOpen(true);
  }

  function toInput(v: FormValues) {
    const hoursByGrade: Record<string, string> = {};
    if (v.g7.enabled) hoursByGrade['7'] = v.g7.hours.trim();
    if (v.g8.enabled) hoursByGrade['8'] = v.g8.hours.trim();
    if (v.g9.enabled) hoursByGrade['9'] = v.g9.hours.trim();
    return { group: v.group, name: v.name, icon: v.icon, iconBg: v.iconBg, hoursByGrade };
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

  function gradeLabels(s: AdminSubject) {
    return GRADES.filter((g) => s.hoursByGrade[String(g) as '7' | '8' | '9'] !== undefined)
      .map((g) => `Kelas ${g}`).join(', ');
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-extrabold text-neutral-900">Mata Pelajaran</h1>
          <p className="text-sm text-neutral-600">Satu mata pelajaran bisa diajarkan di beberapa kelas — tampil di halaman Akademik.</p>
        </div>
      </div>

      <EntityTable<AdminSubject>
        rows={initialItems}
        getId={(s) => s.id}
        getSearchText={(s) => s.name}
        columns={[
          { header: 'Nama', cell: (s) => <span className="font-medium">{s.icon} {s.name}</span> },
          { header: 'Kelompok', cell: (s) => SUBJECT_GROUP_LABEL[s.group as SubjectGroupKey].split(' — ')[0] },
          { header: 'Kelas', cell: (s) => gradeLabels(s) },
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
          <FormField label="Nama Mata Pelajaran" htmlFor="s-name" error={errors.name?.message}>
            <input id="s-name" className={inputClass} {...register('name')} />
          </FormField>
          <FormField label="Kelompok" htmlFor="s-group" error={errors.group?.message}>
            <select id="s-group" className={inputClass} {...register('group')}>
              {SUBJECT_GROUPS.map((g) => (
                <option key={g.key} value={g.key}>{g.label}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Ikon" htmlFor="s-icon" hint="Emoji, mis. 📘 🔬 🧮" error={errors.icon?.message}>
            <input id="s-icon" className={inputClass} {...register('icon')} />
          </FormField>
          <FormField label="Warna Latar Ikon" htmlFor="s-iconBg" hint="Hex, mis. #DBEAFE" error={errors.iconBg?.message}>
            <input id="s-iconBg" className={inputClass} {...register('iconBg')} />
          </FormField>

          <fieldset className="rounded-md border border-neutral-200 p-3">
            <legend className="px-1 text-sm font-medium text-neutral-700">Kelas & JP</legend>
            <p className="mb-2 text-xs text-neutral-500">Centang kelas tempat mapel ini diajarkan, lalu isi jam pelajaran (JP) per kelas.</p>
            {GRADES.map((g) => {
              const key = GRADE_KEYS[g];
              const enabled = watch(`${key}.enabled`);
              return (
                <div key={g} className="mb-2 flex items-center gap-3 last:mb-0">
                  <label className="flex w-24 items-center gap-2 text-sm">
                    <input type="checkbox" {...register(`${key}.enabled`)} />
                    Kelas {g}
                  </label>
                  <input
                    className={`${inputClass} flex-1 disabled:bg-neutral-100 disabled:text-neutral-400`}
                    placeholder="mis. 4 JP/minggu"
                    disabled={!enabled}
                    aria-label={`JP Kelas ${g}`}
                    {...register(`${key}.hours`)}
                  />
                </div>
              );
            })}
            {errors.g7?.message ? <p className="mt-1 text-sm text-red-600">{errors.g7.message}</p> : null}
            {errors.g7?.hours?.message ? <p className="mt-1 text-sm text-red-600">{errors.g7.hours.message}</p> : null}
            {errors.g8?.hours?.message ? <p className="mt-1 text-sm text-red-600">{errors.g8.hours.message}</p> : null}
            {errors.g9?.hours?.message ? <p className="mt-1 text-sm text-red-600">{errors.g9.hours.message}</p> : null}
          </fieldset>

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
