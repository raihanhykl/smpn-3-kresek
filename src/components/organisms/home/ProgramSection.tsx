import { Container } from '@components/atoms/Container';
import { SectionHeading } from '@components/atoms/SectionHeading';
import { ProgramCard } from '@components/molecules/ProgramCard';
import type { HomePageConfig } from '@config/types';

export function ProgramSection({ data }: { data: HomePageConfig['programs'] }) {
  return (
    <section className="bg-neutral-50 py-24">
      <Container>
        <SectionHeading eyebrow={data.meta.eyebrow} title={data.meta.title} subtitle={data.meta.subtitle} />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {data.cards.map((c) => (
            <ProgramCard key={c.id} data={c} />
          ))}
        </div>
      </Container>
    </section>
  );
}
