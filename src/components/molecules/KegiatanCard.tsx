import type { KegiatanCard as KegiatanCardData } from '@config/types';

export function KegiatanCard({ data }: { data: KegiatanCardData }) {
  return (
    <div className="rounded-md bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="mb-3 text-4xl" aria-hidden>
        {data.icon}
      </div>
      <h3 className="font-heading text-lg font-bold text-neutral-900">{data.title}</h3>
      <span className="mt-2 inline-flex rounded-full bg-primary-bg px-2.5 py-0.5 text-[11px] font-bold text-primary">
        {data.frequency}
      </span>
      <p className="mt-3 text-sm text-neutral-600">{data.description}</p>
    </div>
  );
}
