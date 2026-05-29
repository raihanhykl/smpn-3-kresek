// A subject belongs to one of two fixed groups (Kurikulum Merdeka structure).
// Stored as the SubjectGroupKey; the label is what shows on the public page.
export type SubjectGroupKey = 'wajib' | 'pengembangan';

export const SUBJECT_GROUPS: { key: SubjectGroupKey; label: string }[] = [
  { key: 'wajib', label: 'Kelompok A — Mata Pelajaran Wajib' },
  { key: 'pengembangan', label: 'Kelompok B — Pengembangan Diri' },
];

export const SUBJECT_GROUP_LABEL: Record<SubjectGroupKey, string> = {
  wajib: 'Kelompok A — Mata Pelajaran Wajib',
  pengembangan: 'Kelompok B — Pengembangan Diri',
};

// Display order of groups on the public page.
export const SUBJECT_GROUP_ORDER: Record<SubjectGroupKey, number> = {
  wajib: 0,
  pengembangan: 1,
};

export const GRADES = [7, 8, 9] as const;
export type Grade = (typeof GRADES)[number];
