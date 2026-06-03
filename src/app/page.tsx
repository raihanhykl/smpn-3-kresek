import type { Metadata } from 'next';
import { getContentProvider } from '@lib/data';
import { PageLayout } from '@components/templates/PageLayout';
import { HeroSection } from '@components/organisms/home/HeroSection';
import { StatsSection } from '@components/organisms/home/StatsSection';
import { SambutanSection } from '@components/organisms/home/SambutanSection';
import { AboutSection } from '@components/organisms/home/AboutSection';
import { ProgramSection } from '@components/organisms/home/ProgramSection';
import { GallerySection } from '@components/organisms/home/GallerySection';
import { PrestasiCarouselSection } from '@components/organisms/home/PrestasiCarouselSection';
import { MadingTeaserSection } from '@components/organisms/home/MadingTeaserSection';
import { LokasiSection } from '@components/organisms/home/LokasiSection';
import { CtaFinalSection } from '@components/organisms/CtaFinalSection';

// Number of latest Mading posts shown in the home teaser.
const HOME_MADING_LIMIT = 3;

export const metadata: Metadata = {
  title: 'SMPN 3 Kresek — Beranda',
  description:
    'Website resmi SMP Negeri 3 Kresek, Kabupaten Tangerang, Banten. Sekolah modern dengan Kurikulum Merdeka, fasilitas lengkap, dan ekstrakurikuler beragam.',
};

export default async function HomePage() {
  const provider = getContentProvider();
  const [site, home, mading] = await Promise.all([
    provider.getSiteConfig(),
    provider.getHomePage(),
    provider.getMadingList(),
  ]);
  return (
    <PageLayout site={site} activeRoute="/" transparentOverHero>
      <HeroSection hero={home.hero} />
      <StatsSection data={home.stats} />
      <SambutanSection sambutan={home.sambutan} />
      <AboutSection about={home.about} />
      <ProgramSection data={home.programs} />
      <GallerySection data={home.gallery} />
      <PrestasiCarouselSection data={home.achievements} />
      <MadingTeaserSection items={mading.slice(0, HOME_MADING_LIMIT)} />
      <LokasiSection data={home.lokasi} />
      <CtaFinalSection cta={home.ctaFinal} />
    </PageLayout>
  );
}
