import Link from 'next/link';
import { Container } from '@components/atoms/Container';
import type { SiteConfig } from '@config/types';

export function Footer({ site }: { site: SiteConfig }) {
  return (
    <footer className="bg-neutral-900 pt-18">
      <Container className="pt-14">
        <div className="grid gap-12 border-b border-white/10 pb-14 md:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr] lg:gap-12">
          <div className="max-w-xs">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary font-heading text-base font-extrabold text-white">
                {site.brand.shortName}
              </div>
              <div>
                <div className="font-heading text-[15px] font-bold leading-tight text-white">{site.brand.name}</div>
                <div className="text-[11px] text-neutral-400">{site.brand.location}</div>
              </div>
            </div>
            <p className="mb-5 text-sm leading-relaxed text-neutral-400">{site.brand.tagline}</p>
            <span className="inline-flex items-center gap-2 rounded-sm border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-semibold text-neutral-300">
              <span aria-hidden>🎓</span> {site.accreditation.label}
            </span>
          </div>

          <div>
            <h4 className="mb-5 font-heading text-xs font-bold uppercase tracking-wide text-white">Tautan Cepat</h4>
            <ul className="flex flex-col gap-2.5">
              {site.navigation.map((n) => (
                <li key={n.href}>
                  <Link href={n.href} className="text-sm text-neutral-400 transition-colors hover:text-white">
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-5 font-heading text-xs font-bold uppercase tracking-wide text-white">Kontak</h4>
            <ul className="flex flex-col gap-3 text-sm text-neutral-400">
              <li className="flex items-start gap-2.5">
                <span aria-hidden className="mt-0.5">📍</span>
                <span className="leading-relaxed">{site.contact.address}</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span aria-hidden className="mt-0.5">📞</span>
                <a href={site.contact.phoneHref} className="hover:text-white">
                  {site.contact.phone}
                </a>
              </li>
              <li className="flex items-start gap-2.5">
                <span aria-hidden className="mt-0.5">✉️</span>
                <a href={`mailto:${site.contact.email}`} className="break-all hover:text-white">
                  {site.contact.email}
                </a>
              </li>
              <li className="flex items-start gap-2.5">
                <span aria-hidden className="mt-0.5">🕐</span>
                <span>{site.contact.hours}</span>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-5 font-heading text-xs font-bold uppercase tracking-wide text-white">Ikuti Kami</h4>
            <div className="grid grid-cols-2 gap-2.5">
              {site.social.map((s) => (
                <a
                  key={s.platform}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-sm border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-medium text-neutral-300 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <span aria-hidden>{s.icon}</span>
                  <span className="capitalize">{s.platform}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 py-6 text-sm text-neutral-400">
          <p>{site.footer.copyright}</p>
          <p>{site.footer.designedBy}</p>
        </div>
      </Container>
    </footer>
  );
}
