import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@lib/utils/cn';

export interface IconBoxProps {
  children: ReactNode;
  bgColor?: string;
  size?: 'sm' | 'md' | 'lg';
  rounded?: 'full' | 'lg';
  className?: string;
}

const sizes: Record<NonNullable<IconBoxProps['size']>, string> = {
  sm: 'w-10 h-10 text-lg',
  md: 'w-14 h-14 text-2xl',
  lg: 'w-16 h-16 text-3xl',
};

export function IconBox({ children, bgColor, size = 'md', rounded = 'full', className }: IconBoxProps) {
  const style: CSSProperties = bgColor ? { backgroundColor: bgColor } : {};
  return (
    <div
      className={cn(
        'inline-flex shrink-0 items-center justify-center',
        sizes[size],
        rounded === 'full' ? 'rounded-full' : 'rounded-md',
        !bgColor ? 'bg-primary-bg' : '',
        className,
      )}
      style={style}
    >
      {children}
    </div>
  );
}
