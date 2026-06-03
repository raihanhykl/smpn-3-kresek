'use server';

import { revalidateTag } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { withRole, type ActionResult } from '@/lib/auth/server-action-guard';
import { writeAudit } from '@/lib/security/audit';
import { teacherSchema } from '@/lib/validation/schemas/entities/teacher';
import {
  createTeacher, updateTeacher, deleteTeacher, reorderTeachers,
  getTeacherById,
  type TeacherInput,
} from '@/lib/data/repositories/teacher-repo';
import { syncPhotoUsage } from '@/lib/media/sync-photo-usage';
import type { Teacher } from '@config/types';

const teacherInputSchema = teacherSchema.omit({ id: true });

function revalidateTeachers() {
  revalidateTag('teachers');
  revalidateTag('page:profil');
}

const usageRef = (id: string) => ({
  usedInTable: 'Teacher',
  usedInId: id,
  usedInField: 'photoSrc',
});

export async function createTeacherAction(raw: unknown): Promise<ActionResult<Teacher>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    const input = teacherInputSchema.parse(raw) as TeacherInput;
    const created = await createTeacher(input);
    // No prev photo on create — only link if new photo is a url.
    await syncPhotoUsage(null, created.photo, usageRef(created.id));
    await writeAudit({ userId: user.id, action: 'create_teacher', target: `teacher:${created.id}` }).catch(() => {});
    revalidateTeachers();
    return created;
  });
}

export async function updateTeacherAction(id: string, raw: unknown): Promise<ActionResult<Teacher>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    const input = teacherInputSchema.parse(raw) as TeacherInput;
    const prev = await getTeacherById(id);
    const updated = await updateTeacher(id, input);
    await syncPhotoUsage(prev?.photo ?? null, updated.photo, usageRef(id));
    await writeAudit({ userId: user.id, action: 'update_teacher', target: `teacher:${id}` }).catch(() => {});
    revalidateTeachers();
    return updated;
  });
}

export async function deleteTeacherAction(id: string): Promise<ActionResult<void>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    const prev = await getTeacherById(id);
    await deleteTeacher(id);
    // Unlink the prev usage if there was one.
    await syncPhotoUsage(prev?.photo ?? null, null, usageRef(id));
    await writeAudit({ userId: user.id, action: 'delete_teacher', target: `teacher:${id}` }).catch(() => {});
    revalidateTeachers();
  });
}

export async function reorderTeachersAction(orderedIds: string[]): Promise<ActionResult<void>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    await reorderTeachers(orderedIds);
    await writeAudit({ userId: user.id, action: 'reorder_teacher', target: 'teacher:*' }).catch(() => {});
    revalidateTeachers();
  });
}
