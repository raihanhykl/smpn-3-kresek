import type { Metadata } from 'next';
import { getContentProvider } from '@lib/data';
import { PageLayout } from '@components/templates/PageLayout';
import { PageHeader } from '@components/organisms/PageHeader';
import { Container } from '@components/atoms/Container';
import { MadingList } from '@components/organisms/mading/MadingList';

export const metadata: Metadata = {
  title: 'Mading — SMPN 3 Kresek',
  description: 'Berita dan informasi terbaru seputar SMPN 3 Kresek.',
};

export default async function MadingPage() {
  const provider = getContentProvider();
  const [site, items] = await Promise.all([provider.getSiteConfig(), provider.getMadingList()]);
  return (
    <PageLayout site={site} activeRoute="/mading">
      <PageHeader
        config={{
          title: 'Majalah Dinding',
          subtitle: 'Berita & informasi terbaru sekolah.',
        }}
      />
      <section className="bg-neutral-50 py-16">
        <Container>
          <MadingList items={items} />
        </Container>
      </section>
    </PageLayout>
  );
}
