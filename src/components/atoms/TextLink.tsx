import type { ReactNode } from 'react';
import { cn } from '@lib/utils/cn';

export interface TextLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
  external?: boolean;
}

export function TextLink({ href, children, className, external = false }: TextLinkProps) {
  const externalProps = external ? { target: '_blank', rel: 'noopener noreferrer' } : {};
  return (
    <a
      href={href}
      className={cn(
        'inline-flex items-center gap-2 text-[15px] font-semibold text-primary transition-[gap] duration-200 hover:gap-3',
        className,
      )}
      {...externalProps}
    >
      {children}
    </a>
  );
}
