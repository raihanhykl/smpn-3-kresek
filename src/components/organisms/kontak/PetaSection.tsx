import { Container } from '@components/atoms/Container';
import { SectionHeading } from '@components/atoms/SectionHeading';
import { LinkButton } from '@components/atoms/Button';
import type { ContactPageConfig } from '@config/types';

export function PetaSection({ data }: { data: ContactPageConfig['peta'] }) {
  return (
    <section className="bg-neutral-50 py-24">
      <Container>
        <SectionHeading eyebrow={data.meta.eyebrow} title={data.meta.title} subtitle={data.meta.subtitle} />
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-gradient-to-br from-primary-bg to-white shadow-md">
          <div className="flex min-h-[400px] flex-col items-center justify-center px-6 py-16 text-center">
            <span className="text-7xl" aria-hidden>
              🗺️
            </span>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-neutral-600">{data.placeholderText}</p>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <LinkButton href={data.primaryAction.href} variant="primary" size="sm" target="_blank" rel="noopener noreferrer">
            <span aria-hidden>{data.primaryAction.icon}</span> {data.primaryAction.label}
          </LinkButton>
          <LinkButton href={data.secondaryAction.href} variant="outline-dark" size="sm" target="_blank" rel="noopener noreferrer">
            <span aria-hidden>{data.secondaryAction.icon}</span> {data.secondaryAction.label}
          </LinkButton>
        </div>
      </Container>
    </section>
  );
}
