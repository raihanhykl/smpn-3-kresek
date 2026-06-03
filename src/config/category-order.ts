import type { TeacherCategory, EkskulCategory } from './types';

// Explicit display order per category. Public pages and the admin reorder logic
// both key off these so a row's category determines which group it sorts within
// (alphabetical would order them wrong, e.g. "akademik" before "wajib").
// Single source of truth shared by repositories and the seed script.

export const TEACHER_CATEGORY_ORDER: Record<TeacherCategory, number> = {
  pimpinan: 0,
  guru: 1,
  tu: 2,
};

export const EKSKUL_CATEGORY_ORDER: Record<EkskulCategory, number> = {
  wajib: 0,
  olahraga: 1,
  seni: 2,
  akademik: 3,
  keagamaan: 4,
  lainnya: 5,
};
