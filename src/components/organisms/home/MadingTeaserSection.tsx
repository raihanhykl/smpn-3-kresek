import { Container } from '@components/atoms/Container';
import { SectionHeading } from '@components/atoms/SectionHeading';
import { TextLink } from '@components/atoms/TextLink';
import { MadingCard } from '@components/organisms/mading/MadingCard';
import type { Mading } from '@config/types';

/**
 * Home teaser: the latest few Mading posts + a "lihat semua" link to /mading.
 * Renders nothing when there are no posts (keeps the home page clean before the
 * school publishes anything). Mirrors the GallerySection teaser pattern.
 */
export function MadingTeaserSection({ items }: { items: Mading[] }) {
  if (items.length === 0) return null;
  return (
    <section className="bg-neutral-50 py-24">
      <Container>
        <SectionHeading
          eyebrow="Mading"
          title="Berita & Informasi Terbaru"
          subtitle="Kabar terkini seputar kegiatan dan prestasi SMPN 3 Kresek."
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <MadingCard key={item.id} item={item} />
          ))}
        </div>
        <div className="mt-10 text-center">
          <TextLink href="/mading">
            Lihat Semua Mading <span aria-hidden>→</span>
          </TextLink>
        </div>
      </Container>
    </section>
  );
}
