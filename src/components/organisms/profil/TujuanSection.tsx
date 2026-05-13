import { Container } from '@components/atoms/Container';
import { SectionHeading } from '@components/atoms/SectionHeading';
import type { ProfilePageConfig } from '@config/types';

export function TujuanSection({ data }: { data: ProfilePageConfig['tujuan'] }) {
  return (
    <section className="bg-white py-24">
      <Container>
        <SectionHeading eyebrow={data.meta.eyebrow} title={data.meta.title} subtitle={data.meta.subtitle} />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {data.cards.map((card) => (
            <article key={card.id} className="rounded-md border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="font-heading text-5xl font-extrabold text-primary/70">{card.number}</div>
              <h3 className="mt-3 font-heading text-lg font-bold text-neutral-900">{card.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">{card.description}</p>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
