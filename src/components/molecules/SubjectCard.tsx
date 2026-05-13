import { IconBox } from '@components/atoms/IconBox';
import type { SubjectCard as SubjectCardData } from '@config/types';

export function SubjectCard({ data }: { data: SubjectCardData }) {
  return (
    <div className="rounded-md bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <IconBox bgColor={data.iconBg} className="mb-3">
        <span>{data.icon}</span>
      </IconBox>
      <h4 className="text-sm font-semibold text-neutral-900">{data.name}</h4>
      <p className="mt-0.5 text-xs text-neutral-500">{data.hours}</p>
    </div>
  );
}
