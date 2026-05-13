import { Container } from '@components/atoms/Container';
import { RevealOnScroll } from '@components/atoms/RevealOnScroll';
import { SectionLabel } from '@components/atoms/SectionLabel';
import type { KurikulumConfig } from '@config/types';

export function KurikulumSection({ data }: { data: KurikulumConfig }) {
  return (
    <section className="bg-white py-24">
      <Container>
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <RevealOnScroll>
            <SectionLabel className="mb-3">{data.eyebrow}</SectionLabel>
            <h2 className="font-heading text-[clamp(24px,3vw,40px)] font-extrabold tracking-tight text-neutral-900">
              {data.title}
            </h2>
            <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-neutral-700">
              {data.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {data.chips.map((chip) => (
                <span
                  key={chip}
                  className="inline-flex items-center gap-1.5 rounded-full bg-accent-bg px-3 py-1.5 text-xs font-semibold text-accent"
                >
                  <span aria-hidden>✓</span> {chip}
                </span>
              ))}
            </div>
          </RevealOnScroll>
          <RevealOnScroll className="relative">
            <div
              className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg p-8 text-center text-white shadow-lg"
              style={{ background: 'linear-gradient(135deg, #1565C0, #1E88E5)' }}
            >
              <div>
                <span className="mb-3 block text-7xl" aria-hidden>{data.photoEmoji}</span>
                <p className="whitespace-pre-line text-sm font-medium text-white/85">{data.photoPlaceholderText}</p>
              </div>
            </div>
            <div className="absolute -bottom-6 -right-4 rounded-md bg-white p-4 shadow-lg">
              <div className="font-heading text-3xl font-extrabold text-primary">{data.floatStat.value}</div>
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                {data.floatStat.label}
              </div>
            </div>
          </RevealOnScroll>
        </div>
      </Container>
    </section>
  );
}
