import { Container } from '@components/atoms/Container';
import { LinkButton } from '@components/atoms/Button';
import { RevealOnScroll } from '@components/atoms/RevealOnScroll';
import { SectionLabel } from '@components/atoms/SectionLabel';
import type { AboutConfig } from '@config/types';

export function AboutSection({ about }: { about: AboutConfig }) {
  return (
    <section className="bg-white py-24">
      <Container>
        <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <RevealOnScroll>
            <SectionLabel className="mb-3">{about.eyebrow}</SectionLabel>
            <h2 className="font-heading text-[clamp(28px,3.5vw,44px)] font-extrabold leading-tight tracking-tight text-neutral-900">
              {about.titleLines.map((line, i) => (
                <span key={i} className="block">
                  {line}
                </span>
              ))}
            </h2>
            <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-neutral-700">
              {about.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {about.checks.map((c, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-neutral-700">
                  <span aria-hidden className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-bg text-xs text-accent">
                    ✓
                  </span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
            <LinkButton href={about.cta.href} variant="primary" size="sm" className="mt-6">
              {about.cta.label} <span aria-hidden>{about.cta.icon}</span>
            </LinkButton>
          </RevealOnScroll>
          <RevealOnScroll className="relative">
            <div
              className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg p-8 text-center text-white shadow-lg"
              style={{ background: 'linear-gradient(135deg, #1565C0, #1E88E5)' }}
            >
              <div>
                <span className="mb-3 block text-6xl" aria-hidden>🏫</span>
                <p className="whitespace-pre-line text-sm font-medium text-white/85">{about.photoMainText}</p>
              </div>
            </div>
            <div
              className="absolute -bottom-6 -left-6 flex aspect-square w-32 items-center justify-center overflow-hidden rounded-md p-4 text-center text-white shadow-lg"
              style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)' }}
            >
              <div>
                <span className="block text-3xl" aria-hidden>👨‍🎓</span>
                <p className="mt-1 whitespace-pre-line text-[11px] font-medium text-white/85">{about.photoSubText}</p>
              </div>
            </div>
            <span className="absolute -right-3 -top-3 rounded-full bg-secondary px-4 py-2 text-sm font-bold text-white shadow-md">
              {about.badge}
            </span>
          </RevealOnScroll>
        </div>
      </Container>
    </section>
  );
}
