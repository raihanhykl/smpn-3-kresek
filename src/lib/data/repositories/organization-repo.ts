import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/db/client';
import type { OrgChartLevel } from '@config/types';
import type { OrganizationMemberValidated } from '@/lib/validation/schemas/entities/organization-member';

async function loadOrganizationChart(): Promise<OrgChartLevel[]> {
  const rows = await prisma.organizationMember.findMany({
    orderBy: [{ level: 'asc' }, { order: 'asc' }],
  });
  const byLevel = new Map<number, OrgChartLevel>();
  for (const r of rows) {
    let lvl = byLevel.get(r.level);
    if (!lvl) {
      lvl = { id: `level-${r.level}`, boxes: [] };
      byLevel.set(r.level, lvl);
    }
    lvl.boxes.push({ name: r.name, title: r.role });
  }
  return Array.from(byLevel.values());
}

export const getOrganizationChart = unstable_cache(
  loadOrganizationChart, ['organization'], { tags: ['organization'] },
);

// Admin-facing flat row (one row per member). The public chart groups by level.
export type AdminOrganizationMember = OrganizationMemberValidated;
export type OrganizationMemberInput = Omit<OrganizationMemberValidated, 'id'>;

function rowToAdminMember(r: {
  id: string; name: string; role: string; level: number; parentId: string | null;
}): AdminOrganizationMember {
  return { id: r.id, name: r.name, role: r.role, level: r.level, parentId: r.parentId };
}

async function loadAllOrganizationMembers(): Promise<AdminOrganizationMember[]> {
  const rows = await prisma.organizationMember.findMany({
    orderBy: [{ level: 'asc' }, { order: 'asc' }],
  });
  return rows.map(rowToAdminMember);
}

export const getAllOrganizationMembers = unstable_cache(
  loadAllOrganizationMembers, ['organization', 'all'], { tags: ['organization'] },
);

function inputToColumns(input: OrganizationMemberInput) {
  return { name: input.name, role: input.role, level: input.level, parentId: input.parentId };
}

export async function createOrganizationMember(input: OrganizationMemberInput): Promise<AdminOrganizationMember> {
  const max = await prisma.organizationMember.aggregate({ where: { level: input.level }, _max: { order: true } });
  const order = (max._max.order ?? -1) + 1;
  const row = await prisma.organizationMember.create({ data: { ...inputToColumns(input), order } });
  return rowToAdminMember(row);
}

export async function updateOrganizationMember(id: string, input: OrganizationMemberInput): Promise<AdminOrganizationMember> {
  const row = await prisma.organizationMember.update({ where: { id }, data: inputToColumns(input) });
  return rowToAdminMember(row);
}

// Children's parentId is cleared automatically by the FK's onDelete: SetNull.
export async function deleteOrganizationMember(id: string): Promise<void> {
  await prisma.organizationMember.delete({ where: { id } });
}

/**
 * Reorder per-level (display order is `[level, order]`), so each level gets its
 * own contiguous index. Same per-group approach as reorderTeachers.
 */
export async function reorderOrganizationMembers(orderedIds: string[]): Promise<void> {
  const rows = await prisma.organizationMember.findMany({
    where: { id: { in: orderedIds } },
    select: { id: true, level: true },
  });
  const levelById = new Map(rows.map((r) => [r.id, r.level]));
  const perLevelCounter = new Map<number, number>();
  const updates = orderedIds
    .filter((id) => levelById.has(id))
    .map((id) => {
      const level = levelById.get(id)!;
      const next = perLevelCounter.get(level) ?? 0;
      perLevelCounter.set(level, next + 1);
      return prisma.organizationMember.update({ where: { id }, data: { order: next } });
    });
  await prisma.$transaction(updates);
}
