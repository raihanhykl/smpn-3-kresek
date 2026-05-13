import type { Metadata } from 'next';
import { getContentProvider } from '@lib/data';
import { PageLayout } from '@components/templates/PageLayout';
import { PageHeader } from '@components/organisms/PageHeader';
import { KurikulumSection } from '@components/organisms/akademik/KurikulumSection';
import { MapelSection } from '@components/organisms/akademik/MapelSection';
import { JadwalSection } from '@components/organisms/akademik/JadwalSection';
import { MetodeSection } from '@components/organisms/akademik/MetodeSection';
import { PenilaianSection } from '@components/organisms/akademik/PenilaianSection';
import { KalenderSection } from '@components/organisms/akademik/KalenderSection';
import { CtaFinalSection } from '@components/organisms/CtaFinalSection';

export const metadata: Metadata = {
  title: 'Akademik — SMPN 3 Kresek',
  description: 'Kurikulum, mata pelajaran, metode pembelajaran, dan kalender pendidikan SMPN 3 Kresek.',
};

export default async function AkademikPage() {
  const provider = getContentProvider();
  const [site, page] = await Promise.all([provider.getSiteConfig(), provider.getAcademicPage()]);
  return (
    <PageLayout site={site} activeRoute="/akademik">
      <PageHeader config={page.pageHeader} />
      <KurikulumSection data={page.kurikulum} />
      <MapelSection data={page.mapel} />
      <JadwalSection data={page.jadwal} />
      <MetodeSection data={page.metode} />
      <PenilaianSection data={page.penilaian} />
      <KalenderSection data={page.kalender} />
      <CtaFinalSection cta={page.ctaFinal} />
    </PageLayout>
  );
}
