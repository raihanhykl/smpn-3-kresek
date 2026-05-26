import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/db/client';
import type { Faq } from '@config/types';

async function loadFaqs(): Promise<Faq[]> {
  const rows = await prisma.faq.findMany({ orderBy: [{ category: 'asc' }, { order: 'asc' }] });
  return rows.map((r) => ({
    id: r.id, question: r.question, answer: r.answer,
    category: r.category as Faq['category'],
  }));
}

export const getFaqs = unstable_cache(loadFaqs, ['faqs'], { tags: ['faqs'] });
