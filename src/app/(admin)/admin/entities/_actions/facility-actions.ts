'use server';

import { revalidateTag } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { withRole, type ActionResult } from '@/lib/auth/server-action-guard';
import { writeAudit } from '@/lib/security/audit';
import { facilitySchema } from '@/lib/validation/schemas/entities/facility';
import { z } from 'zod';
import {
  createFacility, updateFacility, deleteFacility, reorderFacilities,
  type FacilityInput, type AdminFacility,
} from '@/lib/data/repositories/facility-repo';

// The id is assigned server-side; strip it from each branch of the union.
const facilityInputSchema = z.discriminatedUnion('kind', [
  facilitySchema.options[0].omit({ id: true }),
  facilitySchema.options[1].omit({ id: true }),
]);

function revalidateFacilities() {
  revalidateTag('facilities');
  revalidateTag('page:fasilitas');
}

export async function createFacilityAction(raw: unknown): Promise<ActionResult<AdminFacility>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    const input = facilityInputSchema.parse(raw) as FacilityInput;
    const created = await createFacility(input);
    await writeAudit({ userId: user.id, action: 'create_facility', target: `facility:${created.id}` }).catch(() => {});
    revalidateFacilities();
    return created;
  });
}

export async function updateFacilityAction(id: string, raw: unknown): Promise<ActionResult<AdminFacility>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    const input = facilityInputSchema.parse(raw) as FacilityInput;
    const updated = await updateFacility(id, input);
    await writeAudit({ userId: user.id, action: 'update_facility', target: `facility:${id}` }).catch(() => {});
    revalidateFacilities();
    return updated;
  });
}

export async function deleteFacilityAction(id: string): Promise<ActionResult<void>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    await deleteFacility(id);
    await writeAudit({ userId: user.id, action: 'delete_facility', target: `facility:${id}` }).catch(() => {});
    revalidateFacilities();
  });
}

export async function reorderFacilitiesAction(orderedIds: string[]): Promise<ActionResult<void>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    await reorderFacilities(orderedIds);
    await writeAudit({ userId: user.id, action: 'reorder_facility', target: 'facility:*' }).catch(() => {});
    revalidateFacilities();
  });
}
