import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from 'react';
import { cn } from '@lib/utils/cn';

type Variant = 'primary' | 'outline' | 'outline-dark' | 'white' | 'ppdb' | 'wa' | 'email';
type Size = 'md' | 'sm';

interface CommonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-sm border-2 border-transparent font-heading font-semibold transition-all duration-200 ease-brand whitespace-nowrap cursor-pointer';

const sizes: Record<Size, string> = {
  md: 'px-7 py-3.5 text-[15px]',
  sm: 'px-5 py-2.5 text-sm',
};

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-dark hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(21,101,192,0.3)]',
  outline: 'border-white/50 text-white hover:bg-white/15 hover:border-white',
  'outline-dark': 'border-neutral-300 text-neutral-700 hover:border-primary hover:text-primary hover:bg-primary-bg',
  white: 'bg-white text-primary border-white hover:bg-white/90 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.2)]',
  ppdb: 'bg-secondary text-white hover:bg-[#D97706] hover:-translate-y-0.5 hover:shadow-md',
  wa: 'bg-[#25D366] text-white hover:bg-[#1FB955] hover:-translate-y-0.5 hover:shadow-md',
  email: 'bg-primary text-white hover:bg-primary-dark hover:-translate-y-0.5 hover:shadow-md',
};

export type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;
export type LinkButtonProps = CommonProps & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={cn(base, sizes[size], variants[variant], className)} {...rest}>
      {children}
    </button>
  );
}

export function LinkButton({
  variant = 'primary',
  size = 'md',
  className,
  children,
  href,
  ...rest
}: LinkButtonProps) {
  return (
    <a href={href} className={cn(base, sizes[size], variants[variant], className)} {...rest}>
      {children}
    </a>
  );
}
