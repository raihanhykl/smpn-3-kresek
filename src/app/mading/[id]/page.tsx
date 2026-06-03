import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getContentProvider } from '@lib/data';
import { PageLayout } from '@components/templates/PageLayout';
import { Container } from '@components/atoms/Container';
import { cldUrl } from '@/lib/media/cldUrl';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const post = await getContentProvider().getMadingById(id);
  return { title: post ? `${post.title} — Mading SMPN 3 Kresek` : 'Mading — SMPN 3 Kresek' };
}

export default async function MadingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const provider = getContentProvider();
  const [site, post] = await Promise.all([provider.getSiteConfig(), provider.getMadingById(id)]);
  if (!post) notFound();

  const paragraphs = (post.body ?? '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const date = new Date(post.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <PageLayout site={site} activeRoute="/mading">
      <article className="bg-white py-16">
        <Container className="max-w-3xl">
          <time className="text-sm font-medium text-neutral-500">{date}</time>
          <h1 className="mt-2 font-heading text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl">{post.title}</h1>
          {paragraphs.length > 0 ? (
            <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-neutral-700">
              {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
            </div>
          ) : null}
          {post.images.length > 0 ? (
            <div className="mt-8 space-y-6">
              {post.images.map((img, i) => (
                <figure key={`${img.src}-${i}`} className="overflow-hidden rounded-lg bg-neutral-900">
                  {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary CDN, native ratio preserved */}
                  <img src={cldUrl(img.src, 'original')} alt={img.alt} className="mx-auto max-h-[70vh] w-full object-contain" />
                </figure>
              ))}
            </div>
          ) : null}
        </Container>
      </article>
    </PageLayout>
  );
}
