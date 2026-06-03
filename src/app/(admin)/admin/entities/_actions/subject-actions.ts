'use server';

import { revalidateTag } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { withRole, type ActionResult } from '@/lib/auth/server-action-guard';
import { writeAudit } from '@/lib/security/audit';
import { subjectSchema } from '@/lib/validation/schemas/entities/subject';
import {
  createSubject, updateSubject, deleteSubject, reorderSubjects,
  type SubjectInput, type AdminSubject,
} from '@/lib/data/repositories/subject-repo';

const subjectInputSchema = subjectSchema.omit({ id: true });

function revalidateSubjects() {
  revalidateTag('subjects');
  revalidateTag('page:akademik');
}

export async function createSubjectAction(raw: unknown): Promise<ActionResult<AdminSubject>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    const input = subjectInputSchema.parse(raw) as SubjectInput;
    const created = await createSubject(input);
    await writeAudit({ userId: user.id, action: 'create_subject', target: `subject:${created.id}` }).catch(() => {});
    revalidateSubjects();
    return created;
  });
}

export async function updateSubjectAction(id: string, raw: unknown): Promise<ActionResult<AdminSubject>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    const input = subjectInputSchema.parse(raw) as SubjectInput;
    const updated = await updateSubject(id, input);
    await writeAudit({ userId: user.id, action: 'update_subject', target: `subject:${id}` }).catch(() => {});
    revalidateSubjects();
    return updated;
  });
}

export async function deleteSubjectAction(id: string): Promise<ActionResult<void>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    await deleteSubject(id);
    await writeAudit({ userId: user.id, action: 'delete_subject', target: `subject:${id}` }).catch(() => {});
    revalidateSubjects();
  });
}

export async function reorderSubjectsAction(orderedIds: string[]): Promise<ActionResult<void>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    await reorderSubjects(orderedIds);
    await writeAudit({ userId: user.id, action: 'reorder_subject', target: 'subject:*' }).catch(() => {});
    revalidateSubjects();
  });
}
