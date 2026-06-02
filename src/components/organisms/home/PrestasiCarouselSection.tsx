'use client';

import { Container } from '@components/atoms/Container';
import { SectionHeading } from '@components/atoms/SectionHeading';
import { BadgeLevel } from '@components/atoms/BadgeLevel';
import { TextLink } from '@components/atoms/TextLink';
import { useCarousel } from '@lib/hooks/useCarousel';
import { cn } from '@lib/utils/cn';
import { cldUrl, cropOf } from '@/lib/media/cldUrl';
import type { HomePageConfig } from '@config/types';

export function PrestasiCarouselSection({ data }: { data: HomePageConfig['achievements'] }) {
  const { index, next, prev, goTo } = useCarousel({ length: data.items.length });
  return (
    <section className="bg-primary-bg py-24">
      <Container>
        <SectionHeading eyebrow={data.meta.eyebrow} title={data.meta.title} subtitle={data.meta.subtitle} />
        <div className="overflow-hidden">
          <div
            className="flex transition-transform duration-500 ease-brand"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {data.items.map((a) => (
              <div key={a.id} className="w-full shrink-0 px-2 md:w-1/2 md:px-3 lg:w-1/3">
                <article className="overflow-hidden rounded-md bg-white shadow-md">
                  {a.photo.kind === 'url' ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Cloudinary CDN already optimises
                    <img
                      src={cldUrl(a.photo.src, 'card', cropOf(a.photo))}
                      alt={a.photo.alt}
                      className="aspect-[4/3] w-full object-cover"
                    />
                  ) : (
                    <div
                      className="flex aspect-[4/3] items-center justify-center text-6xl"
                      style={{ background: `linear-gradient(135deg, ${a.photo.from}, ${a.photo.to})` }}
                    >
                      <span aria-hidden>{a.photo.emoji}</span>
                    </div>
                  )}
                  <div className="p-5">
                    <div className="mb-2 flex items-center justify-between">
                      <BadgeLevel level={a.level} />
                      <span className="text-xs font-semibold text-neutral-400">{a.year}</span>
                    </div>
                    <h3 className="font-heading text-lg font-bold text-neutral-900">{a.title}</h3>
                    <p className="mt-1 text-sm text-neutral-600">
                      {a.recipient} · {a.organizer}
                    </p>
                  </div>
                </article>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={prev}
            aria-label="Prestasi sebelumnya"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-neutral-300 bg-white text-lg text-neutral-700 transition-colors hover:border-primary hover:text-primary"
          >
            ←
          </button>
          <div className="flex items-center gap-2">
            {data.items.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Ke prestasi ${i + 1}`}
                className={cn(
                  'h-2 w-2 rounded-full transition-all',
                  i === index ? 'w-6 bg-primary' : 'bg-neutral-300',
                )}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={next}
            aria-label="Prestasi berikutnya"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-neutral-300 bg-white text-lg text-neutral-700 transition-colors hover:border-primary hover:text-primary"
          >
            →
          </button>
        </div>
        <div className="mt-6 text-center">
          <TextLink href={data.ctaHref}>
            {data.ctaLabel} <span aria-hidden>→</span>
          </TextLink>
        </div>
      </Container>
    </section>
  );
}
