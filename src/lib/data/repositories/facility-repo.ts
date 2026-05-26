import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/db/client';
import type { FacilityCard, FacilityMini } from '@config/types';

export type FacilitiesGrouped = { featured: FacilityCard[]; mini: FacilityMini[] };

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
