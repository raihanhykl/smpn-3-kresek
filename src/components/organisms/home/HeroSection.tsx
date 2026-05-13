import { LinkButton } from '@components/atoms/Button';
import { Container } from '@components/atoms/Container';
import { ScrollDot } from '@components/atoms/ScrollDot';
import type { HeroConfig } from '@config/types';

export function HeroSection({ hero }: { hero: HeroConfig }) {
  return (
    <section
      className="relative flex min-h-[90vh] items-center overflow-hidden pt-24"
      style={{ background: 'linear-gradient(135deg, #0D47A1 0%, #1565C0 60%, #1E88E5 100%)' }}
    >
      <div
        className="absolute inset-0 opacity-25 mix-blend-overlay"
        style={{
          background:
            "url('https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=1600&q=80') center/cover no-repeat",
        }}
        aria-hidden
      />
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 60%, transparent 100%)' }}
        aria-hidden
      />
      <Container className="relative z-10 max-w-3xl py-20 animate-fade-up">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[13px] font-semibold uppercase tracking-wide text-white backdrop-blur">
          <span className="inline-block h-2 w-2 rounded-full bg-secondary" aria-hidden />
          {hero.badge}
        </div>
        <h1 className="font-heading text-[clamp(36px,6vw,72px)] font-extrabold leading-[1.05] tracking-tight text-white">
          {hero.titleLine1}
          <br />
          <span className="text-secondary-light">{hero.titleLine2}</span>
        </h1>
        <p className="mt-5 max-w-xl text-lg font-medium text-white/90">{hero.subtitle}</p>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-white/75">{hero.description}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <LinkButton href={hero.primary.href} variant="primary" className="bg-secondary hover:bg-[#D97706]">
            {hero.primary.label} {hero.primary.icon ? <span aria-hidden>{hero.primary.icon}</span> : null}
          </LinkButton>
          <LinkButton href={hero.secondary.href} variant="outline">
            {hero.secondary.label}
          </LinkButton>
        </div>
      </Container>
      {/* <ScrollDot label={hero.scrollLabel} /> */}
    </section>
  );
}
