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
import { LokasiSection } from '@components/organisms/home/LokasiSection';
import { CtaFinalSection } from '@components/organisms/CtaFinalSection';

export const metadata: Metadata = {
  title: 'SMPN 3 Kresek — Beranda',
  description:
    'Website resmi SMP Negeri 3 Kresek, Kabupaten Tangerang, Banten. Sekolah modern dengan Kurikulum Merdeka, fasilitas lengkap, dan ekstrakurikuler beragam.',
};

export default async function HomePage() {
  const provider = getContentProvider();
  const [site, home] = await Promise.all([provider.getSiteConfig(), provider.getHomePage()]);
  return (
    <PageLayout site={site} activeRoute="/" transparentOverHero>
      <HeroSection hero={home.hero} />
      <StatsSection data={home.stats} />
      <SambutanSection sambutan={home.sambutan} />
      <AboutSection about={home.about} />
      <ProgramSection data={home.programs} />
      <GallerySection data={home.gallery} />
      <PrestasiCarouselSection data={home.achievements} />
      <LokasiSection data={home.lokasi} />
      <CtaFinalSection cta={home.ctaFinal} />
    </PageLayout>
  );
}
