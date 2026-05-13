import type { ReactNode } from 'react';
import { cn } from '@lib/utils/cn';

export interface ContainerProps {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'header' | 'footer' | 'main';
}

export function Container({ children, className, as: Tag = 'div' }: ContainerProps) {
  return <Tag className={cn('mx-auto w-full max-w-[1240px] px-6', className)}>{children}</Tag>;
}
