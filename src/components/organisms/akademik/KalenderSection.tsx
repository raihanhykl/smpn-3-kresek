import { Container } from '@components/atoms/Container';
import { SectionHeading } from '@components/atoms/SectionHeading';
import { CalendarEventRow } from '@components/molecules/CalendarEvent';
import type { AcademicPageConfig } from '@config/types';

export function KalenderSection({ data }: { data: AcademicPageConfig['kalender'] }) {
  return (
    <section className="bg-neutral-50 py-24">
      <Container>
        <SectionHeading eyebrow={data.meta.eyebrow} title={data.meta.title} subtitle={data.meta.subtitle} />
        <div className="mx-auto max-w-4xl space-y-3">
          {data.events.map((e) => (
            <CalendarEventRow key={e.id} data={e} />
          ))}
        </div>
        <div className="mt-10 text-center">
          <a
            href={data.downloadHref}
            download
            className="inline-flex items-center gap-2 rounded-sm bg-primary px-6 py-3 font-heading text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            {data.downloadLabel}
          </a>
        </div>
      </Container>
    </section>
  );
}
