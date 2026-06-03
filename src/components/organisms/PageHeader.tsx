import { Container } from '@components/atoms/Container';
import { BreadcrumbNav } from '@components/molecules/BreadcrumbNav';
import type { PageHeaderConfig } from '@config/types';

export function PageHeader({ config }: { config: PageHeaderConfig }) {
  return (
    <header
      className="relative flex min-h-[36vh] items-end overflow-hidden pb-14"
      style={{ background: 'linear-gradient(135deg, #0D47A1 0%, #1565C0 60%, #1E88E5 100%)' }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-10 mix-blend-overlay" aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(800px circle at 30% 50%, rgba(255,255,255,0.25), transparent 60%), radial-gradient(800px circle at 80% 80%, rgba(255,255,255,0.18), transparent 60%)',
          }}
        />
      </div>
      <Container className="relative z-10 pt-32">
        {config.breadcrumb && config.breadcrumb.length > 0 ? (
          <BreadcrumbNav items={config.breadcrumb} />
        ) : null}
        <h1 className="font-heading text-[clamp(28px,4vw,52px)] font-extrabold leading-tight tracking-tight text-white">
          {config.title}
        </h1>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-white/75">{config.subtitle}</p>
      </Container>
    </header>
  );
}
