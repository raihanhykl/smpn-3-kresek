'use client';

import { useMemo, useState } from 'react';
import { Container } from '@components/atoms/Container';
import { SectionHeading } from '@components/atoms/SectionHeading';
import { FilterTabs } from '@components/molecules/FilterTabs';
import { AccordionItem } from '@components/molecules/AccordionItem';
import { useAccordion } from '@lib/hooks/useAccordion';
import { TextLink } from '@components/atoms/TextLink';
import type { FaqConfig, FaqCategory } from '@config/types';

type FilterValue = FaqCategory | 'all';

export function FaqSection({ data }: { data: FaqConfig }) {
  const [filter, setFilter] = useState<FilterValue>('all');
  const [query, setQuery] = useState('');
  const acc = useAccordion('single');

  const tabs: { value: FilterValue; label: string }[] = [
    { value: 'all', label: data.filterLabels.all },
    { value: 'ppdb', label: data.filterLabels.ppdb },
    { value: 'akademik', label: data.filterLabels.akademik },
    { value: 'administrasi', label: data.filterLabels.administrasi },
    { value: 'lainnya', label: data.filterLabels.lainnya },
  ];

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.items.filter((item) => {
      if (filter !== 'all' && item.category !== filter) return false;
      if (q && !item.question.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data.items, filter, query]);

  return (
    <section className="bg-neutral-50 py-24">
      <Container>
        <SectionHeading eyebrow={data.meta.eyebrow} title={data.meta.title} subtitle={data.meta.subtitle} />
        <div className="mx-auto max-w-3xl">
          <div className="relative mb-6">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg" aria-hidden>
              🔍
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={data.searchPlaceholder}
              className="w-full rounded-sm border border-neutral-300 bg-white px-12 py-3.5 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <FilterTabs tabs={tabs} active={filter} onChange={setFilter} className="mb-8" />
          <div className="space-y-3">
            {visible.length === 0 ? (
              <p className="rounded-md border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
                {data.noResultsText}
              </p>
            ) : (
              visible.map((item) => (
                <AccordionItem
                  key={item.id}
                  id={item.id}
                  title={item.question}
                  open={acc.isOpen(item.id)}
                  onToggle={acc.toggle}
                >
                  <p>{item.answer}</p>
                </AccordionItem>
              ))
            )}
          </div>
          <div className="mt-8 text-center">
            <TextLink href={data.ctaHref}>{data.ctaText}</TextLink>
          </div>
        </div>
      </Container>
    </section>
  );
}
