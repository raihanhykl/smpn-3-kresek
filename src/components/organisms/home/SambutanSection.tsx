import { Container } from '@components/atoms/Container';
import { RevealOnScroll } from '@components/atoms/RevealOnScroll';
import { SectionLabel } from '@components/atoms/SectionLabel';
import type { SambutanConfig } from '@config/types';

export function SambutanSection({ sambutan }: { sambutan: SambutanConfig }) {
  return (
    <section className="bg-secondary-bg py-24">
      <Container>
        <div className="grid gap-12 lg:grid-cols-[2fr_3fr] lg:items-center">
          <RevealOnScroll>
            <div className="relative">
              <span
                aria-hidden
                className="absolute -left-6 -top-6 h-32 w-32 rounded-full"
                style={{ background: 'radial-gradient(circle,#FDE68A,transparent 70%)' }}
              />
              <div
                className="relative aspect-[4/5] overflow-hidden rounded-lg shadow-lg"
                style={{ background: 'linear-gradient(135deg, #1565C0, #1E88E5)' }}
              >
                <div className="flex h-full flex-col items-center justify-center px-6 text-center text-white">
                  <span className="mb-3 text-7xl" aria-hidden>
                    {sambutan.photoEmoji}
                  </span>
                  <p className="whitespace-pre-line text-sm font-medium text-white/85">
                    {sambutan.photoPlaceholderText}
                  </p>
                </div>
              </div>
              <span
                aria-hidden
                className="absolute -bottom-6 -right-4 h-24 w-24 rounded-full bg-primary-bg"
              />
            </div>
          </RevealOnScroll>
          <RevealOnScroll>
            <SectionLabel className="mb-3">{sambutan.eyebrow}</SectionLabel>
            <h2 className="font-heading text-[clamp(24px,3vw,36px)] font-extrabold tracking-tight text-neutral-900">
              {sambutan.title}
            </h2>
            <span className="mt-4 inline-block font-heading text-7xl leading-none text-primary/30" aria-hidden>
              &ldquo;
            </span>
            <div className="-mt-4 space-y-4 text-[15px] leading-relaxed text-neutral-700">
              {sambutan.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            <div className="mt-6 border-l-4 border-primary pl-4">
              <div className="font-semibold text-neutral-900">{sambutan.signatureName}</div>
              <div className="text-sm text-neutral-500">{sambutan.signatureTitle}</div>
            </div>
          </RevealOnScroll>
        </div>
      </Container>
    </section>
  );
}
