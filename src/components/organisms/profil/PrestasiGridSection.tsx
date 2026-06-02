import { Container } from '@components/atoms/Container';
import { SectionHeading } from '@components/atoms/SectionHeading';
import { BadgeLevel } from '@components/atoms/BadgeLevel';
import { cldUrl, cropOf } from '@/lib/media/cldUrl';
import type { ProfilePageConfig } from '@config/types';

export function PrestasiGridSection({ data }: { data: ProfilePageConfig['prestasi'] }) {
  return (
    <section className="bg-white py-24">
      <Container>
        <SectionHeading eyebrow={data.meta.eyebrow} title={data.meta.title} subtitle={data.meta.subtitle} />
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {data.items.map((a) => (
            <article key={a.id} className="overflow-hidden rounded-md bg-white shadow-sm transition-shadow hover:shadow-md">
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
          ))}
        </div>
      </Container>
    </section>
  );
}
