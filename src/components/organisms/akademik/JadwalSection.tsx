import { Container } from '@components/atoms/Container';
import { SectionHeading } from '@components/atoms/SectionHeading';
import { cn } from '@lib/utils/cn';
import type { AcademicPageConfig } from '@config/types';

export function JadwalSection({ data }: { data: AcademicPageConfig['jadwal'] }) {
  return (
    <section className="bg-white py-24">
      <Container>
        <SectionHeading title={data.meta.title} subtitle={data.meta.subtitle} />
        <div className="grid gap-6 lg:grid-cols-2">
          {data.cards.map((card) => {
            const isPrimary = card.bgClass === 'primary';
            return (
              <article
                key={card.id}
                className={cn(
                  'rounded-md p-8 shadow-sm',
                  isPrimary ? 'bg-primary-bg' : 'bg-secondary-bg',
                )}
              >
                <div className="mb-3 text-5xl" aria-hidden>{card.icon}</div>
                <h3 className="font-heading text-xl font-bold text-neutral-900">{card.title}</h3>
                <ul className="mt-4 space-y-2.5 text-sm text-neutral-700">
                  {card.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span
                        className={cn(
                          'mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full',
                          isPrimary ? 'bg-primary' : 'bg-secondary',
                        )}
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
        <p className="mt-8 text-center text-sm text-neutral-500">{data.note}</p>
      </Container>
    </section>
  );
}
