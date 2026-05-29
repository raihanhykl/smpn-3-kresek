import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/db/client';
import type { SubjectGroup } from '@config/types';
import type { SubjectValidated } from '@/lib/validation/schemas/entities/subject';

async function loadSubjectGroupsByGrade(grade: number): Promise<SubjectGroup[]> {
  const rows = await prisma.subject.findMany({
    where: { grade },
    orderBy: [{ groupId: 'asc' }, { order: 'asc' }],
  });
  const byGroup = new Map<string, SubjectGroup>();
  for (const r of rows) {
    let group = byGroup.get(r.groupId);
    if (!group) {
      group = { id: r.groupId, title: r.groupTitle, subjects: [] };
      byGroup.set(r.groupId, group);
    }
    group.subjects.push({
      id: r.id, name: r.name, icon: r.icon, iconBg: r.iconBg, hours: r.hours,
    });
  }
  return Array.from(byGroup.values());
}

export function getSubjectGroupsByGrade(grade: number): Promise<SubjectGroup[]> {
  const cached = unstable_cache(
    () => loadSubjectGroupsByGrade(grade),
    ['subjects', `grade-${grade}`],
    { tags: ['subjects'] },
  );
  return cached();
}

// Admin-facing flat row (one row per subject, not grouped). The public page
// re-groups via getSubjectGroupsByGrade.
export type AdminSubject = SubjectValidated;
export type SubjectInput = Omit<SubjectValidated, 'id'>;

function rowToAdminSubject(r: {
  id: string; grade: number; groupId: string; groupTitle: string;
  name: string; icon: string; iconBg: string; hours: string;
}): AdminSubject {
  return {
    id: r.id, grade: r.grade as AdminSubject['grade'], groupId: r.groupId, groupTitle: r.groupTitle,
    name: r.name, icon: r.icon, iconBg: r.iconBg, hours: r.hours,
  };
}

async function loadAllSubjects(): Promise<AdminSubject[]> {
  const rows = await prisma.subject.findMany({ orderBy: [{ grade: 'asc' }, { order: 'asc' }] });
  return rows.map(rowToAdminSubject);
}

export const getAllSubjects = unstable_cache(
  loadAllSubjects, ['subjects', 'all'], { tags: ['subjects'] },
);

function inputToColumns(input: SubjectInput) {
  return {
    grade: input.grade, groupId: input.groupId, groupTitle: input.groupTitle,
    name: input.name, icon: input.icon, iconBg: input.iconBg, hours: input.hours,
  };
}

export async function createSubject(input: SubjectInput): Promise<AdminSubject> {
  const max = await prisma.subject.aggregate({ where: { grade: input.grade }, _max: { order: true } });
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

/**
 * Reorder per-grade (display order is `[grade, order]`), so each grade gets its
 * own contiguous index. Same per-group approach as reorderTeachers.
 */
export async function reorderSubjects(orderedIds: string[]): Promise<void> {
  const rows = await prisma.subject.findMany({
    where: { id: { in: orderedIds } },
    select: { id: true, grade: true },
  });
  const gradeById = new Map(rows.map((r) => [r.id, r.grade]));
  const perGradeCounter = new Map<number, number>();
  const updates = orderedIds
    .filter((id) => gradeById.has(id))
    .map((id) => {
      const grade = gradeById.get(id)!;
      const next = perGradeCounter.get(grade) ?? 0;
      perGradeCounter.set(grade, next + 1);
      return prisma.subject.update({ where: { id }, data: { order: next } });
    });
  await prisma.$transaction(updates);
}
