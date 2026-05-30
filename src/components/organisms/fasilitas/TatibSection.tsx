'use client';

import { Container } from '@components/atoms/Container';
import { SectionHeading } from '@components/atoms/SectionHeading';
import { AccordionItem } from '@components/molecules/AccordionItem';
import { useAccordion } from '@lib/hooks/useAccordion';
import { cldUrl } from '@/lib/media/cldUrl';
import type { FacilitiesPageConfig } from '@config/types';

export function TatibSection({ data }: { data: FacilitiesPageConfig['tatib'] }) {
  const acc = useAccordion('single');
  // Phase 3: hide download CTA when no PDF is linked.
  const media = data.documentSlot?.media ?? null;
  return (
    <section className="bg-white py-24">
      <Container>
        <SectionHeading eyebrow={data.meta.eyebrow} title={data.meta.title} subtitle={data.meta.subtitle} />
        <div className="mx-auto max-w-3xl space-y-3">
          {data.accordions.map((a) => (
            <AccordionItem key={a.id} id={a.id} icon={a.icon} title={a.title} open={acc.isOpen(a.id)} onToggle={acc.toggle}>
              <ul className="space-y-2">
                {a.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </AccordionItem>
          ))}
        </div>
        {media ? (
          <div className="mt-10 text-center">
            <a
              href={cldUrl(media.publicId, 'pdf')}
              download
              className="inline-flex items-center gap-2 rounded-sm bg-primary px-6 py-3 font-heading text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              ⬇ Unduh Buku Tata Tertib Lengkap (PDF)
            </a>
          </div>
        ) : null}
      </Container>
    </section>
  );
}
