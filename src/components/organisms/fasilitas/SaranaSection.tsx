import { Container } from '@components/atoms/Container';
import { SectionHeading } from '@components/atoms/SectionHeading';
import type { FacilitiesPageConfig } from '@config/types';

export function SaranaSection({ data }: { data: FacilitiesPageConfig['sarana'] }) {
  return (
    <section className="bg-white py-24">
      <Container>
        <SectionHeading eyebrow={data.meta.eyebrow} title={data.meta.title} subtitle={data.meta.subtitle} />
        <div className="mx-auto mb-12 grid max-w-3xl grid-cols-2 gap-4 rounded-md bg-primary-bg p-5 sm:grid-cols-4">
          {data.statStrip.map((s) => (
            <div key={s.label} className="text-center">
              <div className="font-heading text-2xl font-extrabold text-primary">{s.value}</div>
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-600">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="mb-10 grid auto-rows-[220px] grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {data.featured.map((f, idx) => (
            <article
              key={f.id}
              className={`relative overflow-hidden rounded-md shadow-sm transition-shadow hover:shadow-md ${
                idx === 0 ? 'col-span-2 row-span-2' : f.span === 'wide' ? 'col-span-2' : ''
              }`}
              style={{ background: `linear-gradient(135deg, ${f.gradientFrom}, ${f.gradientTo})` }}
            >
              <div className="flex h-full items-center justify-center text-7xl text-white/85" aria-hidden>
                {f.emoji}
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent p-4">
                <h3 className="font-heading text-base font-bold text-white">{f.name}</h3>
                <p className="text-xs text-white/80">{f.description}</p>
              </div>
            </article>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {data.mini.map((m) => (
            <div
              key={m.id}
              className="flex flex-col items-center gap-2 rounded-md border border-neutral-200 bg-white p-4 text-center"
            >
              <span className="text-2xl" aria-hidden>{m.icon}</span>
              <span className="text-xs font-semibold text-neutral-700">{m.name}</span>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
