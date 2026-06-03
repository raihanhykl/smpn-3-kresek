'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { AdminOrganizationMember } from '@/lib/data/repositories/organization-repo';
import { EntityTable } from '@/components/admin/EntityTable';
import { EntityDrawer } from '@/components/admin/EntityDrawer';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import { mapActionError } from '@/components/admin/mapActionError';
import { FormField, inputClass } from '@/components/admin/form/FormField';
import {
  createOrganizationMemberAction, updateOrganizationMemberAction,
  deleteOrganizationMemberAction, reorderOrganizationMembersAction,
} from '@/app/(admin)/admin/entities/_actions/organization-actions';

const formSchema = z.object({
  name: z.string().min(1, 'Nama wajib diisi'),
  role: z.string().min(1, 'Jabatan wajib diisi'),
  level: z.coerce.number().int().min(0, 'Level tidak valid').max(10, 'Level tidak valid'),
  // empty string → no parent (null)
  parentId: z.string(),
});
type FormValues = z.infer<typeof formSchema>;

export function OrganizationMemberManager({ initialItems }: { initialItems: AdminOrganizationMember[] }) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<AdminOrganizationMember | null>(null);
  const [deleting, setDeleting] = useState<AdminOrganizationMember | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const { register, handleSubmit, reset, formState: { errors } } =
    useForm<FormValues>({ resolver: zodResolver(formSchema) });

  function openCreate() {
    setEditing(null);
    setFormError(null);
    reset({ name: '', role: '', level: 0, parentId: '' });
    setDrawerOpen(true);
  }

  function openEdit(m: AdminOrganizationMember) {
    setEditing(m);
    setFormError(null);
    reset({ name: m.name, role: m.role, level: m.level, parentId: m.parentId ?? '' });
    setDrawerOpen(true);
  }

  function toInput(v: FormValues) {
    return { name: v.name, role: v.role, level: v.level, parentId: v.parentId ? v.parentId : null };
  }

  function onSubmit(v: FormValues) {
    setFormError(null);
    startTransition(async () => {
      const result = editing
        ? await updateOrganizationMemberAction(editing.id, toInput(v))
        : await createOrganizationMemberAction(toInput(v));
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
      const result = await deleteOrganizationMemberAction(id);
      if (result.ok) {
        setDeleting(null);
        router.refresh();
      } else {
        setDeleteError(mapActionError(result.error));
      }
    });
  }

  function handleReorder(ids: string[]) {
    startTransition(async () => { await reorderOrganizationMembersAction(ids); });
  }

  // Parent options: every other member (exclude self when editing).
  const parentOptions = initialItems.filter((m) => m.id !== editing?.id);
  const nameById = new Map(initialItems.map((m) => [m.id, m.name]));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-extrabold text-neutral-900">Struktur Organisasi</h1>
          <p className="text-sm text-neutral-600">Kelola bagan struktur organisasi yang tampil di halaman Profil.</p>
        </div>
      </div>

      <EntityTable<AdminOrganizationMember>
        rows={initialItems}
        getId={(m) => m.id}
        getSearchText={(m) => `${m.name} ${m.role}`}
        columns={[
          { header: 'Nama', cell: (m) => <span className="font-medium">{m.name}</span> },
          { header: 'Jabatan', cell: (m) => m.role },
          { header: 'Level', cell: (m) => m.level },
          { header: 'Atasan', cell: (m) => (m.parentId ? nameById.get(m.parentId) ?? '—' : '—') },
        ]}
        onEdit={openEdit}
        onDelete={(m) => setDeleting(m)}
        onReorder={handleReorder}
        addButton={
          <button
            type="button"
            onClick={openCreate}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
          >
            + Tambah Anggota
          </button>
        }
      />

      <EntityDrawer open={drawerOpen} title={editing ? 'Edit Anggota' : 'Tambah Anggota'} onClose={() => setDrawerOpen(false)}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Nama" htmlFor="o-name" error={errors.name?.message}>
            <input id="o-name" className={inputClass} {...register('name')} />
          </FormField>
          <FormField label="Jabatan" htmlFor="o-role" error={errors.role?.message}>
            <input id="o-role" className={inputClass} {...register('role')} />
          </FormField>
          <FormField label="Level" htmlFor="o-level" hint="0 = paling atas (mis. Kepala Sekolah)" error={errors.level?.message}>
            <input id="o-level" type="number" min={0} max={10} className={inputClass} {...register('level')} />
          </FormField>
          <FormField label="Atasan" htmlFor="o-parent" hint="Opsional — kosongkan jika tidak ada" error={errors.parentId?.message}>
            <select id="o-parent" className={inputClass} {...register('parentId')}>
              <option value="">— Tidak ada —</option>
              {parentOptions.map((m) => (
                <option key={m.id} value={m.id}>{m.name} ({m.role})</option>
              ))}
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
        itemName={deleting?.name ?? ''}
        onConfirm={confirmDelete}
        onCancel={() => { setDeleting(null); setDeleteError(null); }}
        error={deleteError ?? undefined}
      />
    </div>
  );
}
