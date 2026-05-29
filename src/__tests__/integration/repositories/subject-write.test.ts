import { prisma } from '@/lib/db/client';
import {
  createSubject, updateSubject, deleteSubject, reorderSubjects, getAllSubjects,
} from '@/lib/data/repositories/subject-repo';
import { getSubjectGroupsByGrade } from '@/lib/data/repositories/subject-repo';

function input(overrides = {}) {
  return {
    grade: 7 as const, groupId: 'kelompok-a', groupTitle: 'Kelompok A',
    name: 'Matematika', icon: '🧮', iconBg: 'bg-blue-100', hours: '4 JP', ...overrides,
  };
}

describe('subject write repository', () => {
  beforeEach(async () => { await prisma.subject.deleteMany({}); });
  afterAll(async () => { await prisma.subject.deleteMany({}); await prisma.$disconnect(); });

  it('create + update + delete roundtrip', async () => {
    const s = await createSubject(input());
    expect(s.id).toBeTruthy();
    expect(s.grade).toBe(7);
    const u = await updateSubject(s.id, input({ name: 'IPA' }));
    expect(u.name).toBe('IPA');
    await deleteSubject(s.id);
    expect(await prisma.subject.findUnique({ where: { id: s.id } })).toBeNull();
  });

  it('reorder renumbers PER-GRADE, not globally', async () => {
    const g7a = await createSubject(input({ grade: 7, name: 'MTK7' }));
    const g7b = await createSubject(input({ grade: 7, name: 'IPA7' }));
    const g8a = await createSubject(input({ grade: 8, name: 'MTK8' }));
    await reorderSubjects([g7b.id, g8a.id, g7a.id]);
    const rows = await prisma.subject.findMany({ where: { id: { in: [g7a.id, g7b.id, g8a.id] } } });
    const byId = new Map(rows.map((r) => [r.id, r]));
    expect(byId.get(g7b.id)?.order).toBe(0);
    expect(byId.get(g7a.id)?.order).toBe(1);
    expect(byId.get(g8a.id)?.order).toBe(0); // grade 8 restarts at 0
  });

  it('public getSubjectGroupsByGrade re-groups admin rows', async () => {
    await createSubject(input({ grade: 9, groupId: 'g1', groupTitle: 'G1', name: 'A' }));
    await createSubject(input({ grade: 9, groupId: 'g1', groupTitle: 'G1', name: 'B' }));
    await createSubject(input({ grade: 9, groupId: 'g2', groupTitle: 'G2', name: 'C' }));
    const groups = await getSubjectGroupsByGrade(9);
    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.id === 'g1')?.subjects).toHaveLength(2);
    const all = await getAllSubjects();
    expect(all.filter((s) => s.grade === 9)).toHaveLength(3);
  });
});
