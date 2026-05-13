'use client';

import { useState, useMemo } from 'react';
import { Container } from '@components/atoms/Container';
import { SectionHeading } from '@components/atoms/SectionHeading';
import { FilterTabs } from '@components/molecules/FilterTabs';
import { EkskulCard } from '@components/molecules/EkskulCard';
import type { FacilitiesPageConfig, EkskulCategory } from '@config/types';

type FilterValue = EkskulCategory | 'all';

const CATS: EkskulCategory[] = ['wajib', 'olahraga', 'seni', 'akademik', 'keagamaan', 'lainnya'];

export function EkskulSection({ data }: { data: FacilitiesPageConfig['ekskul'] }) {
  const [active, setActive] = useState<FilterValue>('all');
  const tabs = useMemo<{ value: FilterValue; label: string }[]>(() => {
    const labels = data.filterLabels;
    const all: { value: FilterValue; label: string }[] = [{ value: 'all', label: labels.all }];
    for (const c of CATS) {
      const lbl = labels[c];
      if (lbl) all.push({ value: c, label: lbl });
    }
    return all;
  }, [data.filterLabels]);

  const visible = active === 'all' ? data.items : data.items.filter((i) => i.category === active);

  return (
    <section className="bg-neutral-50 py-24">
      <Container>
        <SectionHeading eyebrow={data.meta.eyebrow} title={data.meta.title} subtitle={data.meta.subtitle} />
        <div className="mx-auto mb-10 grid max-w-2xl grid-cols-3 gap-4 rounded-md bg-white p-5 shadow-sm">
          {data.statStrip.map((s) => (
            <div key={s.label} className="text-center">
              <div className="font-heading text-xl font-extrabold text-primary">{s.value}</div>
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-600">{s.label}</div>
            </div>
          ))}
        </div>
        <FilterTabs tabs={tabs} active={active} onChange={setActive} className="mb-10" />
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {visible.map((e) => (
            <EkskulCard key={e.id} data={e} />
          ))}
        </div>
      </Container>
    </section>
  );
}
