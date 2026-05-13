'use client';

import { useState } from 'react';
import { Container } from '@components/atoms/Container';
import { SectionHeading } from '@components/atoms/SectionHeading';
import { FilterTabs } from '@components/molecules/FilterTabs';
import { SubjectCard } from '@components/molecules/SubjectCard';
import type { AcademicPageConfig } from '@config/types';

type TabId = AcademicPageConfig['mapel']['tabs'][number]['id'];

export function MapelSection({ data }: { data: AcademicPageConfig['mapel'] }) {
  const initial = data.tabs[0]?.id ?? 'kelas7';
  const [active, setActive] = useState<TabId>(initial);
  const current = data.tabs.find((t) => t.id === active) ?? data.tabs[0];

  return (
    <section className="bg-neutral-50 py-24">
      <Container>
        <SectionHeading eyebrow={data.meta.eyebrow} title={data.meta.title} subtitle={data.meta.subtitle} />
        <FilterTabs
          tabs={data.tabs.map((t) => ({ value: t.id, label: t.label }))}
          active={active}
          onChange={setActive}
          className="mb-10"
        />
        {current?.groups.map((group) => (
          <div key={group.id} className="mb-10 last:mb-0">
            <h3 className="mb-5 font-heading text-lg font-bold text-neutral-700">{group.title}</h3>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {group.subjects.map((s) => (
                <SubjectCard key={s.id} data={s} />
              ))}
            </div>
          </div>
        ))}
      </Container>
    </section>
  );
}
