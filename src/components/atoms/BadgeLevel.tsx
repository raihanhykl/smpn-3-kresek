import type { AchievementLevel } from '@config/types';
import { cn } from '@lib/utils/cn';

const styles: Record<AchievementLevel, { className: string; label: string }> = {
  kabupaten: { className: 'bg-[#DBEAFE] text-[#1D4ED8]', label: 'Kabupaten' },
  provinsi: { className: 'bg-[#D1FAE5] text-[#065F46]', label: 'Provinsi' },
  nasional: { className: 'bg-[#FEF9C3] text-[#713F12]', label: 'Nasional' },
  internasional: { className: 'bg-[#F3E8FF] text-[#581C87]', label: 'Internasional' },
};

export function BadgeLevel({ level, className }: { level: AchievementLevel; className?: string }) {
  const s = styles[level];
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide', s.className, className)}>
      {s.label}
    </span>
  );
}
