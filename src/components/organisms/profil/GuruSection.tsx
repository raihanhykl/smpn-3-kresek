'use client';

import { useState, useMemo } from 'react';
import { Container } from '@components/atoms/Container';
import { SectionHeading } from '@components/atoms/SectionHeading';
import { FilterTabs } from '@components/molecules/FilterTabs';
import { TeacherCard } from '@components/molecules/TeacherCard';
import type { ProfilePageConfig, TeacherCategory } from '@config/types';

type FilterValue = TeacherCategory | 'all';

export function GuruSection({ data }: { data: ProfilePageConfig['guru'] }) {
  const [active, setActive] = useState<FilterValue>('all');

  const tabs = useMemo<{ value: FilterValue; label: string }[]>(
    () => [
      { value: 'all', label: data.filterLabels.all },
      { value: 'pimpinan', label: data.filterLabels.pimpinan },
      { value: 'guru', label: data.filterLabels.guru },
      { value: 'tu', label: data.filterLabels.tu },
    ],
    [data.filterLabels],
  );

  const visible = active === 'all' ? data.teachers : data.teachers.filter((t) => t.category === active);

  return (
    <section className="bg-neutral-50 py-24">
      <Container>
        <SectionHeading eyebrow={data.meta.eyebrow} title={data.meta.title} subtitle={data.meta.subtitle} />
        <FilterTabs tabs={tabs} active={active} onChange={setActive} variant="underline" className="mb-10" />
        <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {visible.map((t) => (
            <TeacherCard key={t.id} data={t} />
          ))}
        </div>
      </Container>
    </section>
  );
}
