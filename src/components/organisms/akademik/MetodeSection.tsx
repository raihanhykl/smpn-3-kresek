import { Container } from '@components/atoms/Container';
import type { AcademicPageConfig } from '@config/types';

export function MetodeSection({ data }: { data: AcademicPageConfig['metode'] }) {
  return (
    <section
      className="py-24 text-white"
      style={{ background: 'linear-gradient(135deg, #0D47A1 0%, #1565C0 60%, #1E88E5 100%)' }}
    >
      <Container>
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
            {data.meta.eyebrow}
          </span>
          <h2 className="mt-3 font-heading text-[clamp(24px,3vw,40px)] font-extrabold tracking-tight text-white">
            {data.meta.title}
          </h2>
          <p className="mt-3 text-base text-white/80">{data.meta.subtitle}</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {data.cards.map((c) => (
            <article key={c.id} className="rounded-md bg-white p-6 shadow-md">
              <div className="mb-3 text-4xl" aria-hidden>{c.icon}</div>
              <h3 className="font-heading text-lg font-bold text-neutral-900">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">{c.description}</p>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
