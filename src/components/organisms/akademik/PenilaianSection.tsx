import { Container } from '@components/atoms/Container';
import { SectionHeading } from '@components/atoms/SectionHeading';
import { Badge } from '@components/atoms/Badge';
import type { AcademicPageConfig } from '@config/types';

export function PenilaianSection({ data }: { data: AcademicPageConfig['penilaian'] }) {
  return (
    <section className="bg-white py-24">
      <Container>
        <SectionHeading eyebrow={data.meta.eyebrow} title={data.meta.title} subtitle={data.meta.subtitle} />
        <p className="mx-auto mb-12 max-w-3xl text-center text-[15px] leading-relaxed text-neutral-600">{data.intro}</p>
        <div className="grid gap-5 md:grid-cols-3">
          {data.cards.map((c) => (
            <article key={c.id} className="rounded-md border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="mb-3 text-4xl" aria-hidden>{c.icon}</div>
              <h3 className="font-heading text-lg font-bold text-neutral-900">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">{c.description}</p>
              <Badge tone="primary" className="mt-4">{c.badge}</Badge>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
