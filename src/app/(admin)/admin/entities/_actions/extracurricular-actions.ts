'use server';

import { revalidateTag } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { withRole, type ActionResult } from '@/lib/auth/server-action-guard';
import { writeAudit } from '@/lib/security/audit';
import { extracurricularSchema } from '@/lib/validation/schemas/entities/extracurricular';
import {
  createExtracurricular, updateExtracurricular, deleteExtracurricular, reorderExtracurriculars,
  type ExtracurricularInput,
} from '@/lib/data/repositories/extracurricular-repo';
import type { Extracurricular } from '@config/types';

const extracurricularInputSchema = extracurricularSchema.omit({ id: true });

function revalidateExtracurriculars() {
  revalidateTag('extracurriculars');
  revalidateTag('page:fasilitas');
}

export async function createExtracurricularAction(raw: unknown): Promise<ActionResult<Extracurricular>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    const input = extracurricularInputSchema.parse(raw) as ExtracurricularInput;
    const created = await createExtracurricular(input);
    await writeAudit({ userId: user.id, action: 'create_extracurricular', target: `extracurricular:${created.id}` }).catch(() => {});
    revalidateExtracurriculars();
    return created;
  });
}

export async function updateExtracurricularAction(id: string, raw: unknown): Promise<ActionResult<Extracurricular>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    const input = extracurricularInputSchema.parse(raw) as ExtracurricularInput;
    const updated = await updateExtracurricular(id, input);
    await writeAudit({ userId: user.id, action: 'update_extracurricular', target: `extracurricular:${id}` }).catch(() => {});
    revalidateExtracurriculars();
    return updated;
  });
}

export async function deleteExtracurricularAction(id: string): Promise<ActionResult<void>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    await deleteExtracurricular(id);
    await writeAudit({ userId: user.id, action: 'delete_extracurricular', target: `extracurricular:${id}` }).catch(() => {});
    revalidateExtracurriculars();
  });
}

export async function reorderExtracurricularsAction(orderedIds: string[]): Promise<ActionResult<void>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    await reorderExtracurriculars(orderedIds);
    await writeAudit({ userId: user.id, action: 'reorder_extracurricular', target: 'extracurricular:*' }).catch(() => {});
    revalidateExtracurriculars();
  });
}
