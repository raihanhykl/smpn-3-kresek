import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/db/client';
import type { SubjectGroup } from '@config/types';

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
