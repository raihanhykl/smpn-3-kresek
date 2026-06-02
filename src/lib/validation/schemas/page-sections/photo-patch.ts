import { z } from 'zod';
import { photoSchema } from '../shared';

/**
 * Phase 5 — the fixed catalog of editable section-photo slots. Single source of
 * truth: the admin editor iterates this to render slots, the action validates
 * against it, and the editor page loads current photos for each. Adding a slot
 * here (plus the matching type field + render branch) is all it takes to make a
 * new section photo admin-editable.
 */
export const PAGE_PHOTO_SLOTS = [
  { pageKey: 'home',     sectionKey: 'hero',      field: 'photo',     label: 'Foto Latar Beranda (Hero)', aspect: 16 / 9, emoji: '🏫' },
  { pageKey: 'home',     sectionKey: 'sambutan',  field: 'photo',     label: 'Foto Kepala Sekolah',       aspect: 4 / 5,  emoji: '👤' },
  { pageKey: 'home',     sectionKey: 'about',     field: 'photoMain', label: 'Foto Tentang Kami (Utama)', aspect: 4 / 3,  emoji: '🏫' },
  { pageKey: 'home',     sectionKey: 'about',     field: 'photoSub',  label: 'Foto Tentang Kami (Kecil)', aspect: 1 / 1,  emoji: '👨‍🎓' },
  { pageKey: 'profil',   sectionKey: 'sejarah',   field: 'photo',     label: 'Foto Sejarah',              aspect: 5 / 6,  emoji: '🏫' },
  { pageKey: 'akademik', sectionKey: 'kurikulum', field: 'photo',     label: 'Foto Kurikulum',            aspect: 4 / 3,  emoji: '📚' },
] as const;

export type PagePhotoSlot = (typeof PAGE_PHOTO_SLOTS)[number];

export const pageSectionPhotoPatchSchema = z
  .object({
    pageKey: z.enum(['home', 'profil', 'akademik']),
    sectionKey: z.enum(['hero', 'sambutan', 'about', 'sejarah', 'kurikulum']),
    field: z.enum(['photo', 'photoMain', 'photoSub']),
    photo: photoSchema,
  })
  .superRefine((p, ctx) => {
    // The (pageKey, sectionKey, field) triple must be a real catalog slot.
    const ok = PAGE_PHOTO_SLOTS.some(
      (s) => s.pageKey === p.pageKey && s.sectionKey === p.sectionKey && s.field === p.field,
    );
    if (!ok) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Slot foto tidak dikenal' });
    }
  });

export type PageSectionPhotoPatch = z.infer<typeof pageSectionPhotoPatchSchema>;
