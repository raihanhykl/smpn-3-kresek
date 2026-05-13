import type { Metadata } from 'next';
import { getContentProvider } from '@lib/data';
import { PageLayout } from '@components/templates/PageLayout';
import { PageHeader } from '@components/organisms/PageHeader';
import { SaranaSection } from '@components/organisms/fasilitas/SaranaSection';
import { EkskulSection } from '@components/organisms/fasilitas/EkskulSection';
import { KegiatanSection } from '@components/organisms/fasilitas/KegiatanSection';
import { GaleriSection } from '@components/organisms/fasilitas/GaleriSection';
import { TatibSection } from '@components/organisms/fasilitas/TatibSection';
import { CtaFinalSection } from '@components/organisms/CtaFinalSection';

export const metadata: Metadata = {
  title: 'Fasilitas & Kegiatan — SMPN 3 Kresek',
  description: 'Sarana lengkap dan kegiatan beragam di SMPN 3 Kresek.',
};

export default async function FasilitasPage() {
  const provider = getContentProvider();
  const [site, page] = await Promise.all([provider.getSiteConfig(), provider.getFacilitiesPage()]);
  return (
    <PageLayout site={site} activeRoute="/fasilitas">
      <PageHeader config={page.pageHeader} />
      <SaranaSection data={page.sarana} />
      <EkskulSection data={page.ekskul} />
      <KegiatanSection data={page.kegiatan} />
      <GaleriSection data={page.galeri} />
      <TatibSection data={page.tatib} />
      <CtaFinalSection cta={page.ctaFinal} />
    </PageLayout>
  );
}
