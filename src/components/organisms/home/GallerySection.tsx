import { Container } from '@components/atoms/Container';
import { SectionHeading } from '@components/atoms/SectionHeading';
import { GalleryItem } from '@components/molecules/GalleryItem';
import { TextLink } from '@components/atoms/TextLink';
import type { HomePageConfig } from '@config/types';

export function GallerySection({ data }: { data: HomePageConfig['gallery'] }) {
  return (
    <section className="bg-white py-24">
      <Container>
        <SectionHeading eyebrow={data.meta.eyebrow} title={data.meta.title} subtitle={data.meta.subtitle} />
        {/* Phase 4: uniform 4:3 grid — every card is the same size (span/2x2
            mosaic dropped) for an even, easy-to-manage gallery. */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {data.items.map((item) => (
            <GalleryItem key={item.id} data={item} />
          ))}
        </div>
        <div className="mt-10 text-center">
          <TextLink href={data.ctaHref}>
            {data.ctaLabel} <span aria-hidden>→</span>
          </TextLink>
        </div>
      </Container>
    </section>
  );
}
