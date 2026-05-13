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
        <div className="grid auto-rows-[180px] grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {data.items.map((item, idx) => (
            <GalleryItem
              key={item.id}
              data={item}
              className={
                idx === 0
                  ? 'sm:col-span-2 sm:row-span-2 row-span-2'
                  : item.span === 'wide'
                    ? 'sm:col-span-2'
                    : ''
              }
            />
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
