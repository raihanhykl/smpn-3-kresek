import { prisma } from '@/lib/db/client';
import {
  createOrganizationMember, updateOrganizationMember, deleteOrganizationMember,
  reorderOrganizationMembers, getAllOrganizationMembers,
} from '@/lib/data/repositories/organization-repo';

describe('organization member write repository', () => {
  beforeEach(async () => { await prisma.organizationMember.deleteMany({}); });
  afterAll(async () => { await prisma.organizationMember.deleteMany({}); await prisma.$disconnect(); });

  it('create + update + delete roundtrip', async () => {
    const m = await createOrganizationMember({ name: 'Kepsek', role: 'Kepala Sekolah', level: 0, parentId: null });
    expect(m.id).toBeTruthy();
    expect(m.parentId).toBeNull();
    const u = await updateOrganizationMember(m.id, { name: 'Kepsek Baru', role: 'Kepala Sekolah', level: 0, parentId: null });
    expect(u.name).toBe('Kepsek Baru');
    await deleteOrganizationMember(m.id);
    expect(await prisma.organizationMember.findUnique({ where: { id: m.id } })).toBeNull();
  });

  it('deleting a parent clears children parentId (FK SetNull), not cascade', async () => {
    const parent = await createOrganizationMember({ name: 'Kepsek', role: 'KS', level: 0, parentId: null });
    const child = await createOrganizationMember({ name: 'Wakil', role: 'Waka', level: 1, parentId: parent.id });
    await deleteOrganizationMember(parent.id);
    const childRow = await prisma.organizationMember.findUnique({ where: { id: child.id } });
    expect(childRow).not.toBeNull();
    expect(childRow?.parentId).toBeNull();
  });

  it('reorder renumbers PER-LEVEL, not globally', async () => {
    const a = await createOrganizationMember({ name: 'A', role: 'r', level: 1, parentId: null });
    const b = await createOrganizationMember({ name: 'B', role: 'r', level: 1, parentId: null });
    const c = await createOrganizationMember({ name: 'C', role: 'r', level: 2, parentId: null });
    await reorderOrganizationMembers([b.id, c.id, a.id]);
    const rows = await prisma.organizationMember.findMany({ where: { id: { in: [a.id, b.id, c.id] } } });
    const byId = new Map(rows.map((r) => [r.id, r]));
    expect(byId.get(b.id)?.order).toBe(0);
    expect(byId.get(a.id)?.order).toBe(1);
    expect(byId.get(c.id)?.order).toBe(0); // level 2 restarts at 0
  });

  it('getAllOrganizationMembers returns flat list ordered by level', async () => {
    await createOrganizationMember({ name: 'Top', role: 'r', level: 0, parentId: null });
    await createOrganizationMember({ name: 'Mid', role: 'r', level: 1, parentId: null });
    const all = await getAllOrganizationMembers();
    expect(all.map((m) => m.level)).toEqual([0, 1]);
  });
});
