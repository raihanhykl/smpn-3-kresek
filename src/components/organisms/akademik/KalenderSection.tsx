import { Container } from '@components/atoms/Container';
import { SectionHeading } from '@components/atoms/SectionHeading';
import { cldUrl } from '@/lib/media/cldUrl';
import type { AcademicPageConfig } from '@config/types';

export function KalenderSection({ data }: { data: AcademicPageConfig['kalender'] }) {
  // Kalender pendidikan is delivered ONLY as an uploaded PDF (admin → Dokumen).
  // When a PDF is linked, show a download/view button; otherwise a friendly fallback.
  const media = data.documentSlot?.media ?? null;
  return (
    <section className="bg-neutral-50 py-24">
      <Container>
        <SectionHeading eyebrow={data.meta.eyebrow} title={data.meta.title} subtitle={data.meta.subtitle} />
        <div className="mx-auto max-w-2xl">
          {media ? (
            <div className="flex flex-col items-center gap-4 rounded-xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
              <span className="text-5xl" aria-hidden>📅</span>
              <p className="text-sm text-neutral-600">
                Kalender pendidikan tahun ajaran berjalan tersedia dalam format PDF.
              </p>
              {/* Opens the PDF in a new tab → the browser's native viewer (which has its
                  own download button). target=_blank + rel for safety. */}
              <a
                href={cldUrl(media.publicId, 'pdf')}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 font-heading text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
              >
                <span aria-hidden>⬇</span> Lihat / Unduh Kalender Pendidikan (PDF)
              </a>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center">
              <span className="mb-3 block text-5xl" aria-hidden>📅</span>
              <p className="text-sm font-medium text-neutral-600">
                Kalender pendidikan belum tersedia saat ini.
              </p>
              <p className="mt-1 text-xs text-neutral-400">
                Silakan periksa kembali di lain waktu — kalender akan ditampilkan begitu diunggah oleh sekolah.
              </p>
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}
