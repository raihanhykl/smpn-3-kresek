import type { CalendarEvent as CalendarEventData, CalendarEventType } from '@config/types';

const typeStyle: Record<CalendarEventType, string> = {
  kbm: 'bg-[#D1FAE5] text-[#065F46]',
  ujian: 'bg-[#FEE2E2] text-[#991B1B]',
  libur: 'bg-[#DBEAFE] text-[#1D4ED8]',
  acara: 'bg-[#FEF9C3] text-[#713F12]',
};

export function CalendarEventRow({ data }: { data: CalendarEventData }) {
  return (
    <div className="grid grid-cols-1 gap-4 rounded-md border border-neutral-200 bg-white p-5 md:grid-cols-[160px_1fr_auto] md:items-center">
      <div className="font-semibold text-neutral-900">{data.date}</div>
      <div>
        <div className="font-medium text-neutral-800">{data.title}</div>
        <div className="mt-0.5 text-sm text-neutral-500">{data.sub}</div>
      </div>
      <span
        className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${typeStyle[data.type]}`}
      >
        {data.typeLabel}
      </span>
    </div>
  );
}
