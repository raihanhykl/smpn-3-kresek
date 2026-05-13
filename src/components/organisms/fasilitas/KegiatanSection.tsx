import { Container } from '@components/atoms/Container';
import { SectionHeading } from '@components/atoms/SectionHeading';
import { KegiatanCard } from '@components/molecules/KegiatanCard';
import type { FacilitiesPageConfig } from '@config/types';

export function KegiatanSection({ data }: { data: FacilitiesPageConfig['kegiatan'] }) {
  return (
    <section className="bg-white py-24">
      <Container>
        <SectionHeading eyebrow={data.meta.eyebrow} title={data.meta.title} subtitle={data.meta.subtitle} />
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {data.cards.map((c) => (
            <KegiatanCard key={c.id} data={c} />
          ))}
        </div>
      </Container>
    </section>
  );
}
