'use client';

import { useScrollReveal } from '@lib/hooks/useScrollReveal';
import { useCountUp } from '@lib/hooks/useCountUp';
import { IconBox } from '@components/atoms/IconBox';
import type { StatCard as StatCardData } from '@config/types';

export function StatCard({ data }: { data: StatCardData }) {
  const { ref, visible } = useScrollReveal<HTMLDivElement>();
  const target = data.numeric ?? 0;
  const animated = useCountUp({ target, start: visible && target > 0 });
  const displayValue = data.numeric == null ? data.value : `${animated}${data.suffix ?? ''}`;
  return (
    <div ref={ref} className="rounded-md bg-white p-7 text-center shadow-sm transition-shadow hover:shadow-md">
      <IconBox bgColor={data.iconBg} size="lg" className="mx-auto mb-4">
        <span>{data.icon}</span>
      </IconBox>
      <div className="font-heading text-[clamp(32px,4vw,48px)] font-extrabold leading-none tracking-tight text-neutral-900">
        {displayValue}
      </div>
      <div className="mt-2 text-sm font-medium text-neutral-600">{data.label}</div>
    </div>
  );
}
