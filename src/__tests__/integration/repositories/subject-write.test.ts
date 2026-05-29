import { prisma } from '@/lib/db/client';
import {
  createSubject, updateSubject, deleteSubject, reorderSubjects, getAllSubjects,
  getSubjectGroupsByGrade,
} from '@/lib/data/repositories/subject-repo';

function input(overrides = {}) {
  return {
    group: 'wajib' as const, name: 'Matematika', icon: '🧮', iconBg: '#DBEAFE',
    hoursByGrade: { '7': '5 JP', '8': '5 JP', '9': '6 JP' }, ...overrides,
  };
}

describe('subject write repository (deduped, hoursByGrade)', () => {
  beforeEach(async () => { await prisma.subject.deleteMany({}); });
  afterAll(async () => { await prisma.subject.deleteMany({}); await prisma.$disconnect(); });

  it('create + update + delete roundtrip; hoursByGrade persists per grade', async () => {
    const s = await createSubject(input());
    expect(s.id).toBeTruthy();
    expect(s.hoursByGrade).toEqual({ '7': '5 JP', '8': '5 JP', '9': '6 JP' });
    const u = await updateSubject(s.id, input({ name: 'IPA', hoursByGrade: { '7': '5 JP' } }));
    expect(u.name).toBe('IPA');
    expect(u.hoursByGrade).toEqual({ '7': '5 JP' });
    await deleteSubject(s.id);
    expect(await prisma.subject.findUnique({ where: { id: s.id } })).toBeNull();
  });

  it('one row appears in every grade it is taught in (no duplication)', async () => {
    // PPKn taught in 7,8,9 → a single row, surfaced in all three grade views.
    await createSubject(input({ name: 'PPKn', hoursByGrade: { '7': '2 JP', '8': '2 JP', '9': '2 JP' } }));
    // Bimbingan Konseling only 8,9.
    await createSubject(input({ group: 'pengembangan', name: 'Bimbingan Konseling', hoursByGrade: { '8': '1 JP', '9': '1 JP' } }));

    const g7 = await getSubjectGroupsByGrade(7);
    const g8 = await getSubjectGroupsByGrade(8);
    const g9 = await getSubjectGroupsByGrade(9);

    const namesIn = (groups: Awaited<ReturnType<typeof getSubjectGroupsByGrade>>) =>
      groups.flatMap((grp) => grp.subjects.map((s) => s.name));

    expect(namesIn(g7)).toEqual(['PPKn']); // BK not in kelas 7
    expect(namesIn(g8).sort()).toEqual(['Bimbingan Konseling', 'PPKn']);
    expect(namesIn(g9).sort()).toEqual(['Bimbingan Konseling', 'PPKn']);

    // Only ONE row in the DB for PPKn (deduped), surfaced across grades.
    expect(await prisma.subject.count()).toBe(2);
  });

  it('groups are ordered wajib before pengembangan; subject hours match the grade', async () => {
    await createSubject(input({ group: 'pengembangan', name: 'Seni', hoursByGrade: { '7': '3 JP' } }));
    await createSubject(input({ group: 'wajib', name: 'MTK', hoursByGrade: { '7': '5 JP' } }));
    const g7 = await getSubjectGroupsByGrade(7);
    expect(g7.map((grp) => grp.id)).toEqual(['wajib', 'pengembangan']);
    const mtk = g7[0]?.subjects.find((s) => s.name === 'MTK');
    expect(mtk?.hours).toBe('5 JP');
  });

  it('reorder sets order by global index', async () => {
    const a = await createSubject(input({ name: 'A' }));
    const b = await createSubject(input({ name: 'B' }));
    await reorderSubjects([b.id, a.id]);
    const all = await getAllSubjects();
    expect(all.map((s) => s.name)).toEqual(['B', 'A']);
  });
});
