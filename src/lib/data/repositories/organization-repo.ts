import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/db/client';
import type { OrgChartLevel } from '@config/types';

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
