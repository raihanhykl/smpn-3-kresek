import { Container } from '@components/atoms/Container';
import { SectionHeading } from '@components/atoms/SectionHeading';
import type { VisiMisiConfig } from '@config/types';

export function VisiMisiSection({ data }: { data: VisiMisiConfig }) {
  return (
    <section className="bg-primary-bg py-24">
      <Container>
        <SectionHeading eyebrow={data.meta.eyebrow} title={data.meta.title} subtitle={data.meta.subtitle} />
        <div className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-md border-l-4 border-primary bg-white p-8 shadow-sm">
            <div className="mb-4 text-4xl" aria-hidden>{data.visi.icon}</div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-primary">{data.visi.label}</div>
            <h3 className="mt-2 font-heading text-xl font-extrabold leading-snug text-neutral-900 lg:text-2xl">
              <em className="not-italic">{data.visi.statement}</em>
            </h3>
          </article>
          <article className="rounded-md border-l-4 border-secondary bg-white p-8 shadow-sm">
            <div className="mb-4 text-4xl" aria-hidden>{data.misi.icon}</div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-secondary">{data.misi.label}</div>
            <ol className="mt-3 space-y-2 text-[15px] text-neutral-700">
              {data.misi.items.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-bg text-xs font-bold text-accent">
                    {i + 1}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </article>
        </div>
      </Container>
    </section>
  );
}
