import { IconBox } from '@components/atoms/IconBox';
import { TextLink } from '@components/atoms/TextLink';
import type { ProgramCard as ProgramCardData } from '@config/types';

export function ProgramCard({ data }: { data: ProgramCardData }) {
  return (
    <div className="group rounded-md bg-white p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md">
      <IconBox bgColor={data.iconBg} size="lg" className="mb-5">
        <span>{data.icon}</span>
      </IconBox>
      <h3 className="mb-2.5 font-heading text-xl font-bold text-neutral-900">{data.title}</h3>
      <p className="mb-5 text-sm leading-relaxed text-neutral-600">{data.description}</p>
      <TextLink href={data.href}>
        {data.linkText} <span aria-hidden>→</span>
      </TextLink>
    </div>
  );
}
