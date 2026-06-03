'use client';

import { useState } from 'react';
import { Container } from '@components/atoms/Container';
import { SectionHeading } from '@components/atoms/SectionHeading';
import { FilterTabs } from '@components/molecules/FilterTabs';
import { GalleryItem } from '@components/molecules/GalleryItem';
import type { FacilitiesPageConfig } from '@config/types';

type FilterValue = 'all' | 'akademik' | 'ekskul' | 'acara' | 'fasilitas';

export function GaleriSection({ data }: { data: FacilitiesPageConfig['galeri'] }) {
  const [active, setActive] = useState<FilterValue>('all');
  const tabs: { value: FilterValue; label: string }[] = [
    { value: 'all', label: data.filterLabels.all },
    { value: 'akademik', label: data.filterLabels.akademik },
    { value: 'ekskul', label: data.filterLabels.ekskul },
    { value: 'acara', label: data.filterLabels.acara },
    { value: 'fasilitas', label: data.filterLabels.fasilitas },
  ];
  const visible = active === 'all' ? data.items : data.items.filter((i) => i.category === active);
  return (
    <section className="bg-neutral-50 py-24">
      <Container>
        <SectionHeading eyebrow={data.meta.eyebrow} title={data.meta.title} subtitle={data.meta.subtitle} />
        <FilterTabs tabs={tabs} active={active} onChange={setActive} className="mb-10" />
        {/* Phase 4: uniform 4:3 grid — every card is the same size (span mosaic
            dropped) so the gallery reads evenly and photos are easy to swap. */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {visible.map((item) => (
            <GalleryItem key={item.id} data={item} />
          ))}
        </div>
      </Container>
    </section>
  );
}
