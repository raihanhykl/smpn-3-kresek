import { SectionLabel } from './SectionLabel';
import { cn } from '@lib/utils/cn';

export interface SectionHeadingProps {
  eyebrow?: string | undefined;
  title: string;
  subtitle?: string | undefined;
  align?: 'center' | 'left';
  className?: string | undefined;
}

export function SectionHeading({ eyebrow, title, subtitle, align = 'center', className }: SectionHeadingProps) {
  return (
    <div className={cn(align === 'center' ? 'mx-auto max-w-[640px] text-center' : 'max-w-[640px]', 'mb-14', className)}>
      {eyebrow ? <SectionLabel className="mb-3">{eyebrow}</SectionLabel> : null}
      <h2 className="font-heading text-[clamp(24px,3vw,40px)] font-extrabold leading-tight tracking-tight text-neutral-900">
        {title}
      </h2>
      {subtitle ? <p className="mt-3 text-base leading-relaxed text-neutral-400">{subtitle}</p> : null}
    </div>
  );
}
