import { Container } from '@components/atoms/Container';
import { RevealOnScroll } from '@components/atoms/RevealOnScroll';
import { SectionLabel } from '@components/atoms/SectionLabel';
import { TimelineItem } from '@components/molecules/TimelineItem';
import { cldUrl, cropOf } from '@/lib/media/cldUrl';
import type { ProfilePageConfig } from '@config/types';

export function SejarahSection({ data }: { data: ProfilePageConfig['sejarah'] }) {
  return (
    <section className="bg-white py-24">
      <Container>
        <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr]">
          <RevealOnScroll>
            <SectionLabel className="mb-3">{data.eyebrow}</SectionLabel>
            <h2 className="font-heading text-[clamp(24px,3vw,40px)] font-extrabold tracking-tight text-neutral-900">
              {data.title}
            </h2>
            <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-neutral-700">
              {data.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            <ol className="mt-8">
              {data.timeline.map((item, i) => (
                <TimelineItem key={item.id} data={item} index={i} total={data.timeline.length} />
              ))}
            </ol>
          </RevealOnScroll>
          <RevealOnScroll>
            <div
              className="flex aspect-[5/6] items-center justify-center overflow-hidden rounded-lg text-center text-white shadow-lg"
              style={
                data.photo?.kind === 'url'
                  ? undefined
                  : { background: 'linear-gradient(135deg, #1565C0, #1E88E5)' }
              }
            >
              {data.photo?.kind === 'url' ? (
                // eslint-disable-next-line @next/next/no-img-element -- Cloudinary CDN already optimises
                <img
                  src={cldUrl(data.photo.src, 'card', cropOf(data.photo))}
                  alt={data.photo.alt}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="p-8">
                  <span className="mb-3 block text-7xl" aria-hidden>{data.photoEmoji}</span>
                  <p className="whitespace-pre-line text-sm font-medium text-white/85">{data.photoPlaceholderText}</p>
                </div>
              )}
            </div>
          </RevealOnScroll>
        </div>
      </Container>
    </section>
  );
}
