'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Faq } from '@config/types';
import { EntityTable } from '@/components/admin/EntityTable';
import { EntityDrawer } from '@/components/admin/EntityDrawer';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import { FormField, inputClass } from '@/components/admin/form/FormField';
import {
  createFaqAction, updateFaqAction, deleteFaqAction, reorderFaqsAction,
} from '@/app/(admin)/admin/entities/_actions/faq-actions';

const formSchema = z.object({
  question: z.string().min(1, 'Pertanyaan wajib diisi'),
  answer: z.string().min(1, 'Jawaban wajib diisi'),
  category: z.enum(['ppdb', 'akademik', 'administrasi', 'lainnya']),
});
type FormValues = z.infer<typeof formSchema>;

const CATEGORY_LABEL: Record<Faq['category'], string> = {
  ppdb: 'PPDB', akademik: 'Akademik', administrasi: 'Administrasi', lainnya: 'Lainnya',
};

export function FaqManager({ initialFaqs }: { initialFaqs: Faq[] }) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Faq | null>(null);
  const [deleting, setDeleting] = useState<Faq | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const { register, handleSubmit, reset, formState: { errors } } =
    useForm<FormValues>({ resolver: zodResolver(formSchema) });

  function openCreate() {
    setEditing(null);
    setFormError(null);
    reset({ question: '', answer: '', category: 'ppdb' });
    setDrawerOpen(true);
  }

  function openEdit(f: Faq) {
    setEditing(f);
    setFormError(null);
    reset({ question: f.question, answer: f.answer, category: f.category });
    setDrawerOpen(true);
  }

  function toInput(v: FormValues) {
    return { question: v.question, answer: v.answer, category: v.category };
  }

  function onSubmit(v: FormValues) {
    setFormError(null);
    startTransition(async () => {
      const result = editing
        ? await updateFaqAction(editing.id, toInput(v))
        : await createFaqAction(toInput(v));
      if (result.ok) {
        setDrawerOpen(false);
        router.refresh();
      } else {
        setFormError(result.error === 'forbidden' ? 'Anda tidak punya izin.' : result.error);
      }
    });
  }

  function confirmDelete() {
    if (!deleting) return;
    const id = deleting.id;
    startTransition(async () => {
      const result = await deleteFaqAction(id);
      if (result.ok) {
        setDeleting(null);
        router.refresh();
      } else {
        setFormError(result.error);
      }
    });
  }

  function handleReorder(ids: string[]) {
    startTransition(async () => { await reorderFaqsAction(ids); });
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-extrabold text-neutral-900">FAQ</h1>
          <p className="text-sm text-neutral-600">Kelola pertanyaan umum yang tampil di halaman Kontak.</p>
        </div>
      </div>

      <EntityTable<Faq>
        rows={initialFaqs}
        getId={(f) => f.id}
        getSearchText={(f) => f.question}
        columns={[
          { header: 'Pertanyaan', cell: (f) => <span className="block max-w-md truncate font-medium">{f.question}</span> },
          { header: 'Kategori', cell: (f) => CATEGORY_LABEL[f.category] },
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
            + Tambah FAQ
          </button>
        }
      />

      <EntityDrawer open={drawerOpen} title={editing ? 'Edit FAQ' : 'Tambah FAQ'} onClose={() => setDrawerOpen(false)}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Pertanyaan" htmlFor="f-question" error={errors.question?.message}>
            <input id="f-question" className={inputClass} {...register('question')} />
          </FormField>
          <FormField label="Jawaban" htmlFor="f-answer" error={errors.answer?.message}>
            <textarea id="f-answer" rows={4} className={inputClass} {...register('answer')} />
          </FormField>
          <FormField label="Kategori" htmlFor="f-category" error={errors.category?.message}>
            <select id="f-category" className={inputClass} {...register('category')}>
              <option value="ppdb">PPDB</option>
              <option value="akademik">Akademik</option>
              <option value="administrasi">Administrasi</option>
              <option value="lainnya">Lainnya</option>
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
        itemName={deleting?.question ?? ''}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
