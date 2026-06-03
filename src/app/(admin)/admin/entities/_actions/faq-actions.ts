'use server';

import { revalidateTag } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { withRole, type ActionResult } from '@/lib/auth/server-action-guard';
import { writeAudit } from '@/lib/security/audit';
import { faqSchema } from '@/lib/validation/schemas/entities/faq';
import {
  createFaq, updateFaq, deleteFaq, reorderFaqs, type FaqInput,
} from '@/lib/data/repositories/faq-repo';
import type { Faq } from '@config/types';

const faqInputSchema = faqSchema.omit({ id: true });

function revalidateFaqs() {
  revalidateTag('faqs');
  revalidateTag('page:kontak');
}

export async function createFaqAction(raw: unknown): Promise<ActionResult<Faq>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    const input = faqInputSchema.parse(raw) as FaqInput;
    const created = await createFaq(input);
    await writeAudit({ userId: user.id, action: 'create_faq', target: `faq:${created.id}` }).catch(() => {});
    revalidateFaqs();
    return created;
  });
}

export async function updateFaqAction(id: string, raw: unknown): Promise<ActionResult<Faq>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    const input = faqInputSchema.parse(raw) as FaqInput;
    const updated = await updateFaq(id, input);
    await writeAudit({ userId: user.id, action: 'update_faq', target: `faq:${id}` }).catch(() => {});
    revalidateFaqs();
    return updated;
  });
}

export async function deleteFaqAction(id: string): Promise<ActionResult<void>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    await deleteFaq(id);
    await writeAudit({ userId: user.id, action: 'delete_faq', target: `faq:${id}` }).catch(() => {});
    revalidateFaqs();
  });
}

export async function reorderFaqsAction(orderedIds: string[]): Promise<ActionResult<void>> {
  const session = await getSession();
  return withRole(session, ['ADMIN', 'EDITOR'], async (user) => {
    await reorderFaqs(orderedIds);
    await writeAudit({ userId: user.id, action: 'reorder_faq', target: 'faq:*' }).catch(() => {});
    revalidateFaqs();
  });
}
