import { LinkButton } from '@components/atoms/Button';
import { Container } from '@components/atoms/Container';
import { RevealOnScroll } from '@components/atoms/RevealOnScroll';
import type { CtaFinal } from '@config/types';

export function CtaFinalSection({ cta }: { cta: CtaFinal }) {
  return (
    <section
      className="relative overflow-hidden py-24 text-center text-white"
      style={{ background: 'linear-gradient(135deg, #0D47A1 0%, #1565C0 60%, #1565C0 100%)' }}
    >
      <span aria-hidden className="absolute -left-24 -top-24 h-[400px] w-[400px] rounded-full bg-white/8 opacity-80" />
      <span aria-hidden className="absolute -bottom-16 right-24 h-[280px] w-[280px] rounded-full bg-white/8 opacity-80" />
      <Container className="relative z-10">
        <RevealOnScroll>
          <h2 className="mx-auto max-w-3xl font-heading text-[clamp(28px,3.5vw,48px)] font-extrabold leading-tight tracking-tight text-white">
            {cta.titleLines ? cta.titleLines.map((line, i) => <span key={i} className="block">{line}</span>) : cta.title}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[17px] leading-relaxed text-white/85">{cta.subtitle}</p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <LinkButton href={cta.primary.href} variant="white">
              {cta.primary.label}
            </LinkButton>
            {cta.secondary ? (
              <LinkButton href={cta.secondary.href} variant="outline">
                {cta.secondary.label}
              </LinkButton>
            ) : null}
          </div>
        </RevealOnScroll>
      </Container>
    </section>
  );
}
