import { Container } from '@components/atoms/Container';
import { SectionHeading } from '@components/atoms/SectionHeading';
import { StatCard } from '@components/molecules/StatCard';
import type { HomePageConfig } from '@config/types';

export function StatsSection({ data }: { data: HomePageConfig['stats'] }) {
  return (
    <section id="stats" className="bg-neutral-50 py-24">
      <Container>
        <SectionHeading eyebrow={data.meta.eyebrow} title={data.meta.title} subtitle={data.meta.subtitle} />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {data.cards.map((c) => (
            <StatCard key={c.id} data={c} />
          ))}
        </div>
      </Container>
    </section>
  );
}
