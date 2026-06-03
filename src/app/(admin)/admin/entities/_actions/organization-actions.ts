'use server';

import { revalidateTag } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { withRole, type ActionResult } from '@/lib/auth/server-action-guard';
import { writeAudit } from '@/lib/security/audit';
import { organizationMemberSchema } from '@/lib/validation/schemas/entities/organization-member';
import {
  createOrganizationMember, updateOrganizationMember, deleteOrganizationMember, reorderOrganizationMembers,
  type OrganizationMemberInput, type AdminOrganizationMember,
} from '@/lib/data/repositories/organization-repo';

const organizationMemberInputSchema = organizationMemberSchema.omit({ id: true });

function revalidateOrganization() {
  revalidateTag('organization');
  revalidateTag('page:profil');
}

export async function createOrganizationMemberAction(raw: unknown): Promise<ActionResult<AdminOrganizationMember>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    const input = organizationMemberInputSchema.parse(raw) as OrganizationMemberInput;
    const created = await createOrganizationMember(input);
    await writeAudit({ userId: user.id, action: 'create_org_member', target: `org:${created.id}` }).catch(() => {});
    revalidateOrganization();
    return created;
  });
}

export async function updateOrganizationMemberAction(id: string, raw: unknown): Promise<ActionResult<AdminOrganizationMember>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    const input = organizationMemberInputSchema.parse(raw) as OrganizationMemberInput;
    const updated = await updateOrganizationMember(id, input);
    await writeAudit({ userId: user.id, action: 'update_org_member', target: `org:${id}` }).catch(() => {});
    revalidateOrganization();
    return updated;
  });
}

export async function deleteOrganizationMemberAction(id: string): Promise<ActionResult<void>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    await deleteOrganizationMember(id);
    await writeAudit({ userId: user.id, action: 'delete_org_member', target: `org:${id}` }).catch(() => {});
    revalidateOrganization();
  });
}

export async function reorderOrganizationMembersAction(orderedIds: string[]): Promise<ActionResult<void>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    await reorderOrganizationMembers(orderedIds);
    await writeAudit({ userId: user.id, action: 'reorder_org_member', target: 'org:*' }).catch(() => {});
    revalidateOrganization();
  });
}
