import { prisma } from '@/lib/db/client';
import {
  createTeacher, updateTeacher, deleteTeacher, reorderTeachers,
} from '@/lib/data/repositories/teacher-repo';
import type { Teacher } from '@config/types';

const gradientPhoto: Teacher['photo'] = { kind: 'gradient', from: '#000', to: '#fff', emoji: '👤' };

describe('teacher write repository', () => {
  beforeEach(async () => {
    await prisma.teacher.deleteMany({});
  });
  afterAll(async () => {
    await prisma.teacher.deleteMany({});
    await prisma.$disconnect();
  });

  it('createTeacher inserts a row and returns the created Teacher with generated id', async () => {
    const created = await createTeacher({
      name: 'Bu Siti', position: 'Guru Matematika', badge: 'S.Pd.',
      category: 'guru', photo: gradientPhoto,
    });
    expect(created.id).toBeTruthy();
    expect(created.name).toBe('Bu Siti');
    const inDb = await prisma.teacher.findUnique({ where: { id: created.id } });
    expect(inDb?.categoryOrder).toBe(1); // guru = categoryOrder 1
    expect(inDb?.photoKind).toBe('gradient');
  });

  it('createTeacher assigns next order within category', async () => {
    const a = await createTeacher({ name: 'A', position: 'p', badge: 'b', category: 'guru', photo: gradientPhoto });
    const b = await createTeacher({ name: 'B', position: 'p', badge: 'b', category: 'guru', photo: gradientPhoto });
    const aDb = await prisma.teacher.findUnique({ where: { id: a.id } });
    const bDb = await prisma.teacher.findUnique({ where: { id: b.id } });
    expect(aDb?.order).toBe(0);
    expect(bDb?.order).toBe(1);
  });

  it('updateTeacher changes fields', async () => {
    const created = await createTeacher({ name: 'A', position: 'p', badge: 'b', category: 'guru', photo: gradientPhoto });
    const updated = await updateTeacher(created.id, {
      name: 'A Updated', position: 'Wakasek', badge: 'M.Pd.',
      category: 'pimpinan', photo: gradientPhoto,
    });
    expect(updated.name).toBe('A Updated');
    const inDb = await prisma.teacher.findUnique({ where: { id: created.id } });
    expect(inDb?.category).toBe('pimpinan');
    expect(inDb?.categoryOrder).toBe(0); // pimpinan = 0
  });

  it('updateTeacher throws when id missing', async () => {
    await expect(
      updateTeacher('nonexistent', { name: 'x', position: 'p', badge: 'b', category: 'guru', photo: gradientPhoto }),
    ).rejects.toThrow();
  });

  it('deleteTeacher removes the row', async () => {
    const created = await createTeacher({ name: 'A', position: 'p', badge: 'b', category: 'guru', photo: gradientPhoto });
    await deleteTeacher(created.id);
    const inDb = await prisma.teacher.findUnique({ where: { id: created.id } });
    expect(inDb).toBeNull();
  });

  it('reorderTeachers sets order by index within a single category', async () => {
    const a = await createTeacher({ name: 'A', position: 'p', badge: 'b', category: 'guru', photo: gradientPhoto });
    const b = await createTeacher({ name: 'B', position: 'p', badge: 'b', category: 'guru', photo: gradientPhoto });
    const c = await createTeacher({ name: 'C', position: 'p', badge: 'b', category: 'guru', photo: gradientPhoto });
    // New order within guru: c, a, b
    await reorderTeachers([c.id, a.id, b.id]);
    const rows = await prisma.teacher.findMany({ where: { category: 'guru' }, orderBy: { order: 'asc' } });
    expect(rows.map((r) => r.id)).toEqual([c.id, a.id, b.id]);
    expect(rows.map((r) => r.order)).toEqual([0, 1, 2]);
  });

  it('reorderTeachers numbers order PER-CATEGORY when ids span categories', async () => {
    // Two categories interleaved in the dragged list. Each category must get its
    // own 0,1,... sequence — NOT a global index (which would clash at order 0).
    const p1 = await createTeacher({ name: 'P1', position: 'Kepsek', badge: 'b', category: 'pimpinan', photo: gradientPhoto });
    const g1 = await createTeacher({ name: 'G1', position: 'Guru', badge: 'b', category: 'guru', photo: gradientPhoto });
    const g2 = await createTeacher({ name: 'G2', position: 'Guru', badge: 'b', category: 'guru', photo: gradientPhoto });
    // Dragged order (flat list as shown in table): g2, p1, g1
    await reorderTeachers([g2.id, p1.id, g1.id]);
    const guru = await prisma.teacher.findMany({ where: { category: 'guru' }, orderBy: { order: 'asc' } });
    const pimpinan = await prisma.teacher.findMany({ where: { category: 'pimpinan' }, orderBy: { order: 'asc' } });
    // guru re-numbered in dragged relative order: g2 (0), g1 (1)
    expect(guru.map((r) => r.id)).toEqual([g2.id, g1.id]);
    expect(guru.map((r) => r.order)).toEqual([0, 1]);
    // pimpinan re-numbered independently starting at 0
    expect(pimpinan.map((r) => r.order)).toEqual([0]);
  });
});
