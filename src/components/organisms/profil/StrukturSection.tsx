import { Container } from '@components/atoms/Container';
import { SectionHeading } from '@components/atoms/SectionHeading';
import type { ProfilePageConfig } from '@config/types';

export function StrukturSection({ data }: { data: ProfilePageConfig['struktur'] }) {
  return (
    <section className="bg-white py-24">
      <Container>
        <SectionHeading eyebrow={data.meta.eyebrow} title={data.meta.title} subtitle={data.meta.subtitle} />
        <div className="space-y-6">
          {data.chart.levels.map((level, idx) => (
            <div
              key={level.id}
              className={`flex flex-wrap items-center justify-center gap-3 ${idx === 0 ? '' : 'border-t border-dashed border-neutral-200 pt-6'}`}
            >
              {level.boxes.map((box) => (
                <div
                  key={box.name}
                  className="min-w-[180px] flex-1 rounded-md border border-neutral-200 bg-white p-4 text-center shadow-sm sm:flex-none"
                >
                  <div className="font-semibold text-neutral-900">{box.name}</div>
                  <div className="mt-0.5 text-xs text-neutral-500">{box.title}</div>
                </div>
              ))}
            </div>
          ))}
          <div className="border-t border-dashed border-neutral-200 pt-6 text-center text-sm font-medium text-neutral-600">
            {data.chart.studentNote}
          </div>
        </div>
      </Container>
    </section>
  );
}
