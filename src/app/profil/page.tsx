import type { Metadata } from 'next';
import { getContentProvider } from '@lib/data';
import { PageLayout } from '@components/templates/PageLayout';
import { PageHeader } from '@components/organisms/PageHeader';
import { SejarahSection } from '@components/organisms/profil/SejarahSection';
import { VisiMisiSection } from '@components/organisms/profil/VisiMisiSection';
import { TujuanSection } from '@components/organisms/profil/TujuanSection';
import { IdentitasSection } from '@components/organisms/profil/IdentitasSection';
import { StrukturSection } from '@components/organisms/profil/StrukturSection';
import { GuruSection } from '@components/organisms/profil/GuruSection';
import { PrestasiGridSection } from '@components/organisms/profil/PrestasiGridSection';
import { CtaFinalSection } from '@components/organisms/CtaFinalSection';

export const metadata: Metadata = {
  title: 'Profil — SMPN 3 Kresek',
  description: 'Sejarah, visi, misi, dan keluarga besar SMPN 3 Kresek.',
};

export default async function ProfilPage() {
  const provider = getContentProvider();
  const [site, page] = await Promise.all([provider.getSiteConfig(), provider.getProfilePage()]);
  return (
    <PageLayout site={site} activeRoute="/profil">
      <PageHeader config={page.pageHeader} />
      <SejarahSection data={page.sejarah} />
      <VisiMisiSection data={page.visiMisi} />
      <TujuanSection data={page.tujuan} />
      <IdentitasSection data={page.identitas} />
      <StrukturSection data={page.struktur} />
      <GuruSection data={page.guru} />
      <PrestasiGridSection data={page.prestasi} />
      <CtaFinalSection cta={page.ctaFinal} />
    </PageLayout>
  );
}
