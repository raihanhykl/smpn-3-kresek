import { Container } from '@components/atoms/Container';
import { SectionHeading } from '@components/atoms/SectionHeading';
import { Badge } from '@components/atoms/Badge';
import type { ProfilePageConfig } from '@config/types';

export function IdentitasSection({ data }: { data: ProfilePageConfig['identitas'] }) {
  return (
    <section className="bg-neutral-50 py-24">
      <Container>
        <SectionHeading eyebrow={data.meta.eyebrow} title={data.meta.title} subtitle={data.meta.subtitle} />
        <div className="mx-auto max-w-3xl overflow-hidden rounded-md bg-white shadow-sm">
          <dl>
            {data.rows.map((row, i) => (
              <div
                key={`${row.label}-${i}`}
                className="grid grid-cols-1 gap-1 border-b border-neutral-100 px-6 py-4 last:border-b-0 sm:grid-cols-[200px_1fr] sm:gap-4"
              >
                <dt className="text-sm font-medium text-neutral-500">{row.label}</dt>
                <dd className="font-semibold text-neutral-900">
                  {row.badge === 'negeri' ? (
                    <Badge tone="primary">{row.value}</Badge>
                  ) : row.badge === 'akreditasi' ? (
                    <Badge tone="accent">{row.value}</Badge>
                  ) : (
                    row.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </Container>
    </section>
  );
}
