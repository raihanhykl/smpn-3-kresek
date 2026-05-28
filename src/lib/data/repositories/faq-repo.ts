import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/db/client';
import type { Faq } from '@config/types';

async function loadFaqs(): Promise<Faq[]> {
  // Preserve global insertion order so visual baseline matches the static config
  // sequence (q1..qN). Category grouping/filter happens client-side in FaqSection.
  const rows = await prisma.faq.findMany({ orderBy: [{ order: 'asc' }] });
  return rows.map((r) => ({
    id: r.id, question: r.question, answer: r.answer,
    category: r.category as Faq['category'],
  }));
}

export const getFaqs = unstable_cache(loadFaqs, ['faqs'], { tags: ['faqs'] });

export type FaqInput = Omit<Faq, 'id'>;

export async function createFaq(input: FaqInput): Promise<Faq> {
  const max = await prisma.faq.aggregate({ _max: { order: true } });
  const order = (max._max.order ?? -1) + 1;
  const row = await prisma.faq.create({
    data: { question: input.question, answer: input.answer, category: input.category, order },
  });
  return { id: row.id, question: row.question, answer: row.answer, category: row.category as Faq['category'] };
}

export async function updateFaq(id: string, input: FaqInput): Promise<Faq> {
  const row = await prisma.faq.update({
    where: { id },
    data: { question: input.question, answer: input.answer, category: input.category },
  });
  return { id: row.id, question: row.question, answer: row.answer, category: row.category as Faq['category'] };
}

export async function deleteFaq(id: string): Promise<void> {
  await prisma.faq.delete({ where: { id } });
}

export async function reorderFaqs(orderedIds: string[]): Promise<void> {
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.faq.update({ where: { id }, data: { order: index } }),
    ),
  );
}
