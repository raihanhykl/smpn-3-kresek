import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/db/client';
import type { FacilityCard, FacilityMini } from '@config/types';
import type { FacilityValidated } from '@/lib/validation/schemas/entities/facility';

export type FacilitiesGrouped = { featured: FacilityCard[]; mini: FacilityMini[] };

// Admin-facing flat row: the discriminated union (kind tag preserved), used by
// the admin table/form. The public site uses the grouped shape above.
export type AdminFacility = FacilityValidated;
// Distribute Omit over each union member so branch-specific fields survive
// (a plain Omit over a union keeps only the shared keys).
export type FacilityInput =
  FacilityValidated extends infer F ? (F extends { id: string } ? Omit<F, 'id'> : never) : never;

async function loadFacilitiesGrouped(): Promise<FacilitiesGrouped> {
  const rows = await prisma.facility.findMany({ orderBy: [{ kind: 'asc' }, { order: 'asc' }] });
  const featured: FacilityCard[] = [];
  const mini: FacilityMini[] = [];
  for (const r of rows) {
    if (r.kind === 'featured') {
      if (r.description === null || r.emoji === null || r.gradientFrom === null || r.gradientTo === null) {
        throw new Error(`Facility ${r.id}: kind=featured requires description + emoji + gradientFrom + gradientTo`);
      }
      const card: FacilityCard = {
        id: r.id, name: r.name, description: r.description,
        emoji: r.emoji, gradientFrom: r.gradientFrom, gradientTo: r.gradientTo,
      };
      if (r.span) card.span = r.span as NonNullable<FacilityCard['span']>;
      featured.push(card);
    } else if (r.kind === 'mini') {
      if (r.icon === null) {
        throw new Error(`Facility ${r.id}: kind=mini requires icon`);
      }
      mini.push({ id: r.id, name: r.name, icon: r.icon });
    } else {
      throw new Error(`Facility ${r.id}: unknown kind "${r.kind}"`);
    }
  }
  return { featured, mini };
}

export const getFacilitiesGrouped = unstable_cache(
  loadFacilitiesGrouped, ['facilities'], { tags: ['facilities'] },
);

function rowToAdminFacility(r: {
  id: string; kind: string; name: string; description: string | null; emoji: string | null;
  gradientFrom: string | null; gradientTo: string | null; span: string | null; icon: string | null;
}): AdminFacility {
  if (r.kind === 'featured') {
    if (r.description === null || r.emoji === null || r.gradientFrom === null || r.gradientTo === null) {
      throw new Error(`Facility ${r.id}: kind=featured requires description + emoji + gradientFrom + gradientTo`);
    }
    const card: AdminFacility = {
      kind: 'featured', id: r.id, name: r.name, description: r.description,
      emoji: r.emoji, gradientFrom: r.gradientFrom, gradientTo: r.gradientTo,
    };
    if (r.span) card.span = r.span as NonNullable<Extract<AdminFacility, { kind: 'featured' }>['span']>;
    return card;
  }
  if (r.kind === 'mini') {
    if (r.icon === null) throw new Error(`Facility ${r.id}: kind=mini requires icon`);
    return { kind: 'mini', id: r.id, name: r.name, icon: r.icon };
  }
  throw new Error(`Facility ${r.id}: unknown kind "${r.kind}"`);
}

async function loadAllFacilities(): Promise<AdminFacility[]> {
  const rows = await prisma.facility.findMany({ orderBy: [{ kind: 'asc' }, { order: 'asc' }] });
  return rows.map(rowToAdminFacility);
}

export const getAllFacilities = unstable_cache(
  loadAllFacilities, ['facilities', 'all'], { tags: ['facilities'] },
);

function inputToColumns(input: FacilityInput) {
  if (input.kind === 'featured') {
    return {
      kind: 'featured', name: input.name, description: input.description, emoji: input.emoji,
      gradientFrom: input.gradientFrom, gradientTo: input.gradientTo, span: input.span ?? null, icon: null,
    };
  }
  return {
    kind: 'mini', name: input.name, icon: input.icon,
    description: null, emoji: null, gradientFrom: null, gradientTo: null, span: null,
  };
}

export async function createFacility(input: FacilityInput): Promise<AdminFacility> {
  const max = await prisma.facility.aggregate({ where: { kind: input.kind }, _max: { order: true } });
  const order = (max._max.order ?? -1) + 1;
  const row = await prisma.facility.create({ data: { ...inputToColumns(input), order } });
  return rowToAdminFacility(row);
}

export async function updateFacility(id: string, input: FacilityInput): Promise<AdminFacility> {
  const row = await prisma.facility.update({ where: { id }, data: inputToColumns(input) });
  return rowToAdminFacility(row);
}

export async function deleteFacility(id: string): Promise<void> {
  await prisma.facility.delete({ where: { id } });
}

/**
 * Reorder per-kind (display order is `[kind, order]`), so featured and mini each
 * get their own contiguous 0..n index. Same shape as reorderTeachers' per-group logic.
 */
export async function reorderFacilities(orderedIds: string[]): Promise<void> {
  const rows = await prisma.facility.findMany({
    where: { id: { in: orderedIds } },
    select: { id: true, kind: true },
  });
  const kindById = new Map(rows.map((r) => [r.id, r.kind]));
  const perKindCounter = new Map<string, number>();
  const updates = orderedIds
    .filter((id) => kindById.has(id))
    .map((id) => {
      const kind = kindById.get(id)!;
      const next = perKindCounter.get(kind) ?? 0;
      perKindCounter.set(kind, next + 1);
      return prisma.facility.update({ where: { id }, data: { order: next } });
    });
  await prisma.$transaction(updates);
}
