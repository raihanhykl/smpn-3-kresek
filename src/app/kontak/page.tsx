import type { Metadata } from 'next';
import { getContentProvider } from '@lib/data';
import { PageLayout } from '@components/templates/PageLayout';
import { PageHeader } from '@components/organisms/PageHeader';
import { KontakInfoSection } from '@components/organisms/kontak/KontakInfoSection';
import { PetaSection } from '@components/organisms/kontak/PetaSection';
import { ContactFormSection } from '@components/organisms/kontak/ContactFormSection';
import { FaqSection } from '@components/organisms/kontak/FaqSection';
import { CtaFinalSection } from '@components/organisms/CtaFinalSection';

export const metadata: Metadata = {
  title: 'Kontak — SMPN 3 Kresek',
  description: 'Hubungi SMPN 3 Kresek melalui telepon, email, WhatsApp, atau form kontak resmi sekolah.',
};

export default async function KontakPage() {
  const provider = getContentProvider();
  const [site, page] = await Promise.all([provider.getSiteConfig(), provider.getContactPage()]);
  return (
    <PageLayout site={site} activeRoute="/kontak">
      <PageHeader config={page.pageHeader} />
      <KontakInfoSection data={page.kontakInfo} social={site.social} />
      <PetaSection data={page.peta} />
      <ContactFormSection data={page.form} />
      <FaqSection data={page.faq} />
      <CtaFinalSection cta={page.ctaFinal} />
    </PageLayout>
  );
}
