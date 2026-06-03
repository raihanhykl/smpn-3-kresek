import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/db/client';
import type { SubjectGroup } from '@config/types';
import type { SubjectValidated } from '@/lib/validation/schemas/entities/subject';
import {
  SUBJECT_GROUP_LABEL, SUBJECT_GROUP_ORDER, type SubjectGroupKey,
} from '@config/subject-groups';

type HoursByGrade = SubjectValidated['hoursByGrade'];

function rowToAdminSubject(r: {
  id: string; group: string; name: string; icon: string; iconBg: string; hoursByGrade: unknown;
}): SubjectValidated {
  return {
    id: r.id,
    group: r.group as SubjectGroupKey,
    name: r.name,
    icon: r.icon,
    iconBg: r.iconBg,
    hoursByGrade: r.hoursByGrade as HoursByGrade,
  };
}

async function loadSubjectGroupsByGrade(grade: number): Promise<SubjectGroup[]> {
  const gradeKey = String(grade) as keyof HoursByGrade;
  const rows = await prisma.subject.findMany({ orderBy: [{ order: 'asc' }] });

  // Keep only subjects taught in this grade, grouped by their group key.
  const byGroup = new Map<SubjectGroupKey, SubjectGroup>();
  for (const r of rows) {
    const hours = r.hoursByGrade as HoursByGrade;
    const h = hours[gradeKey];
    if (!h) continue; // not taught in this grade
    const groupKey = r.group as SubjectGroupKey;
    let group = byGroup.get(groupKey);
    if (!group) {
      group = { id: groupKey, title: SUBJECT_GROUP_LABEL[groupKey], subjects: [] };
      byGroup.set(groupKey, group);
    }
    group.subjects.push({ id: r.id, name: r.name, icon: r.icon, iconBg: r.iconBg, hours: h });
  }

  // Stable group order (wajib before pengembangan).
  return Array.from(byGroup.values()).sort(
    (a, b) => SUBJECT_GROUP_ORDER[a.id as SubjectGroupKey] - SUBJECT_GROUP_ORDER[b.id as SubjectGroupKey],
  );
}

export function getSubjectGroupsByGrade(grade: number): Promise<SubjectGroup[]> {
  const cached = unstable_cache(
    () => loadSubjectGroupsByGrade(grade),
    ['subjects', `grade-${grade}`],
    { tags: ['subjects'] },
  );
  return cached();
}

// Admin-facing flat row (one row per subject). The public page derives per-grade
// views via getSubjectGroupsByGrade.
export type AdminSubject = SubjectValidated;
export type SubjectInput = Omit<SubjectValidated, 'id'>;

async function loadAllSubjects(): Promise<AdminSubject[]> {
  const rows = await prisma.subject.findMany({ orderBy: [{ order: 'asc' }] });
  return rows.map(rowToAdminSubject);
}

export const getAllSubjects = unstable_cache(
  loadAllSubjects, ['subjects', 'all'], { tags: ['subjects'] },
);

function inputToColumns(input: SubjectInput) {
  return {
    group: input.group, name: input.name, icon: input.icon,
    iconBg: input.iconBg, hoursByGrade: input.hoursByGrade,
  };
}

export async function createSubject(input: SubjectInput): Promise<AdminSubject> {
  const max = await prisma.subject.aggregate({ _max: { order: true } });
  const order = (max._max.order ?? -1) + 1;
  const row = await prisma.subject.create({ data: { ...inputToColumns(input), order } });
  return rowToAdminSubject(row);
}

export async function updateSubject(id: string, input: SubjectInput): Promise<AdminSubject> {
  const row = await prisma.subject.update({ where: { id }, data: inputToColumns(input) });
  return rowToAdminSubject(row);
}

export async function deleteSubject(id: string): Promise<void> {
  await prisma.subject.delete({ where: { id } });
}

export async function reorderSubjects(orderedIds: string[]): Promise<void> {
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.subject.update({ where: { id }, data: { order: index } }),
    ),
  );
}
