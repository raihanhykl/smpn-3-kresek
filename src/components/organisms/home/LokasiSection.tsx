'use client';

import { Container } from '@components/atoms/Container';
import { SectionHeading } from '@components/atoms/SectionHeading';
import { ContactCard } from '@components/molecules/ContactCard';
import { LinkButton, Button } from '@components/atoms/Button';
import type { HomePageConfig } from '@config/types';

export function LokasiSection({ data }: { data: HomePageConfig['lokasi'] }) {
  const handleCopy = (): void => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(data.copyText);
    }
  };
  return (
    <section className="bg-white py-24">
      <Container>
        <SectionHeading eyebrow={data.meta.eyebrow} title={data.meta.title} subtitle={data.meta.subtitle} />
        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-gradient-to-br from-primary-bg to-white">
            <div className="flex h-full min-h-[400px] flex-col items-center justify-center px-6 py-12 text-center">
              <span className="text-6xl" aria-hidden>
                📍
              </span>
              <h3 className="mt-4 font-heading text-lg font-bold text-neutral-900">Google Maps</h3>
              <p className="mt-1 max-w-sm text-sm text-neutral-600">
                SMPN 3 Kresek · Jl. Raya Kresek, Tangerang, Banten
              </p>
              <p className="mt-1 max-w-sm text-xs text-neutral-500">
                Embed iframe maps dapat ditambahkan di sini
              </p>
            </div>
          </div>
          <div>
            <h3 className="font-heading text-2xl font-extrabold text-neutral-900">{data.panelTitle}</h3>
            <p className="mt-2 text-sm text-neutral-600">{data.panelDescription}</p>
            <div className="mt-5 space-y-3">
              {data.cards.map((c, i) => (
                <ContactCard key={i} data={c} />
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <LinkButton href={data.primary.href} variant="primary" size="sm">
                {data.primary.icon ? <span aria-hidden>{data.primary.icon}</span> : null} {data.primary.label}
              </LinkButton>
              <Button onClick={handleCopy} variant="outline-dark" size="sm">
                {data.secondary.icon ? <span aria-hidden>{data.secondary.icon}</span> : null} {data.secondary.label}
              </Button>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
