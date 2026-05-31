import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/db/client';
import type { FacilityCard, FacilityMini } from '@config/types';
import type { FacilityValidated } from '@/lib/validation/schemas/entities/facility';
import { photoFromRow, photoToColumns } from './_photo-columns';

export type FacilitiesGrouped = { featured: FacilityCard[]; mini: FacilityMini[] };

// Admin-facing flat row: the discriminated union (kind tag preserved).
export type AdminFacility = FacilityValidated;
// Distribute Omit over each union member so branch-specific fields survive.
export type FacilityInput =
  FacilityValidated extends infer F ? (F extends { id: string } ? Omit<F, 'id'> : never) : never;

type FacilityRow = {
  id: string; kind: string; name: string; description: string | null;
  photoKind: string | null; photoSrc: string | null; photoAlt: string | null;
  photoFrom: string | null; photoTo: string | null; photoEmoji: string | null;
  span: string | null; icon: string | null;
};

async function loadFacilitiesGrouped(): Promise<FacilitiesGrouped> {
  const rows = await prisma.facility.findMany({ orderBy: [{ kind: 'asc' }, { order: 'asc' }] });
  const featured: FacilityCard[] = [];
  const mini: FacilityMini[] = [];
  for (const r of rows) {
    if (r.kind === 'featured') {
      if (r.description === null || r.photoKind === null) {
        throw new Error(`Facility ${r.id}: kind=featured requires description + photoKind`);
      }
      const card: FacilityCard = {
        id: r.id, name: r.name, description: r.description,
        photo: photoFromRow('Facility', r.id, {
          photoKind: r.photoKind,
          photoSrc: r.photoSrc,
          photoAlt: r.photoAlt,
          photoFrom: r.photoFrom,
          photoTo: r.photoTo,
          photoEmoji: r.photoEmoji,
        }),
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
  loadFacilitiesGrouped, ['facilities', 'v2-photo'], { tags: ['facilities'] },
);

function rowToAdminFacility(r: FacilityRow): AdminFacility {
  if (r.kind === 'featured') {
    if (r.description === null || r.photoKind === null) {
      throw new Error(`Facility ${r.id}: kind=featured requires description + photoKind`);
    }
    const card: AdminFacility = {
      kind: 'featured', id: r.id, name: r.name, description: r.description,
      photo: photoFromRow('Facility', r.id, {
        photoKind: r.photoKind,
        photoSrc: r.photoSrc,
        photoAlt: r.photoAlt,
        photoFrom: r.photoFrom,
        photoTo: r.photoTo,
        photoEmoji: r.photoEmoji,
      }),
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
  loadAllFacilities, ['facilities', 'all', 'v2-photo'], { tags: ['facilities'] },
);

export async function getFacilityById(id: string): Promise<AdminFacility | null> {
  const row = await prisma.facility.findUnique({ where: { id } });
  return row ? rowToAdminFacility(row) : null;
}

function inputToColumns(input: FacilityInput) {
  if (input.kind === 'featured') {
    return {
      kind: 'featured',
      name: input.name,
      description: input.description,
      ...photoToColumns(input.photo),
      span: input.span ?? null,
      icon: null,
    };
  }
  return {
    kind: 'mini',
    name: input.name,
    icon: input.icon,
    description: null,
    photoKind: null,
    photoSrc: null,
    photoAlt: null,
    photoFrom: null,
    photoTo: null,
    photoEmoji: null,
    span: null,
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
