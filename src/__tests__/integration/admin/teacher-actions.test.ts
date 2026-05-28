import { prisma } from '@/lib/db/client';

// Mock auth + revalidateTag so we can call the actions directly.
const mockSession = { user: { id: 'admin-actions-test', role: 'ADMIN' as const } };
jest.mock('@/lib/auth/session', () => ({
  getSession: jest.fn(async () => mockSession),
}));
const revalidateTagMock = jest.fn();
jest.mock('next/cache', () => ({
  unstable_cache: <T extends (...a: unknown[]) => unknown>(fn: T) => fn,
  revalidateTag: (...args: unknown[]) => revalidateTagMock(...args),
  revalidatePath: jest.fn(),
}));

import {
  createTeacherAction, updateTeacherAction, deleteTeacherAction, reorderTeachersAction,
} from '@/app/(admin)/admin/entities/_actions/teacher-actions';

const validInput = {
  name: 'Bu Ani', position: 'Guru IPA', badge: 'S.Pd.',
  category: 'guru', photo: { kind: 'gradient', from: '#000', to: '#fff', emoji: '🔬' },
};

describe('teacher server actions', () => {
  beforeAll(async () => {
    await prisma.auditLog.deleteMany({ where: { userId: 'admin-actions-test' } });
    await prisma.user.deleteMany({ where: { id: 'admin-actions-test' } });
    await prisma.user.create({
      data: { id: 'admin-actions-test', email: 'aat@test.local', passwordHash: 'x', name: 'AAT', role: 'ADMIN' },
    });
  });
  beforeEach(async () => {
    await prisma.teacher.deleteMany({});
    revalidateTagMock.mockClear();
  });
  afterAll(async () => {
    await prisma.teacher.deleteMany({});
    await prisma.auditLog.deleteMany({ where: { userId: 'admin-actions-test' } });
    await prisma.user.deleteMany({ where: { id: 'admin-actions-test' } });
    await prisma.$disconnect();
  });

  it('createTeacherAction creates + audits + revalidates teachers & page:profil', async () => {
    const result = await createTeacherAction(validInput);
    expect(result.ok).toBe(true);
    const count = await prisma.teacher.count();
    expect(count).toBe(1);
    const audits = await prisma.auditLog.findMany({ where: { userId: 'admin-actions-test', action: 'create_teacher' } });
    expect(audits.length).toBe(1);
    expect(revalidateTagMock).toHaveBeenCalledWith('teachers');
    expect(revalidateTagMock).toHaveBeenCalledWith('page:profil');
  });

  it('createTeacherAction rejects invalid input with typed error', async () => {
    const result = await createTeacherAction({ ...validInput, category: 'invalid-cat' });
    expect(result.ok).toBe(false);
    expect(await prisma.teacher.count()).toBe(0);
  });

  it('updateTeacherAction updates existing', async () => {
    const created = await createTeacherAction(validInput);
    expect(created.ok).toBe(true);
    const id = created.ok ? created.data.id : '';
    const result = await updateTeacherAction(id, { ...validInput, name: 'Bu Ani Updated' });
    expect(result.ok).toBe(true);
    const row = await prisma.teacher.findUnique({ where: { id } });
    expect(row?.name).toBe('Bu Ani Updated');
  });

  it('deleteTeacherAction deletes + audits', async () => {
    const created = await createTeacherAction(validInput);
    const id = created.ok ? created.data.id : '';
    const result = await deleteTeacherAction(id);
    expect(result.ok).toBe(true);
    expect(await prisma.teacher.count()).toBe(0);
    const audits = await prisma.auditLog.findMany({ where: { userId: 'admin-actions-test', action: 'delete_teacher' } });
    expect(audits.length).toBe(1);
  });

  it('reorderTeachersAction reorders', async () => {
    const a = await createTeacherAction(validInput);
    const b = await createTeacherAction({ ...validInput, name: 'B' });
    const aId = a.ok ? a.data.id : '';
    const bId = b.ok ? b.data.id : '';
    const result = await reorderTeachersAction([bId, aId]);
    expect(result.ok).toBe(true);
    const rows = await prisma.teacher.findMany({ orderBy: { order: 'asc' } });
    expect(rows.map((r) => r.id)).toEqual([bId, aId]);
  });
});
