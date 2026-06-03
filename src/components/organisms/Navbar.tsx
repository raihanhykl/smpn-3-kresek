'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Container } from '@components/atoms/Container';
import { useScrollY } from '@lib/hooks/useScrollY';
import { cn } from '@lib/utils/cn';
import type { SiteConfig, Route } from '@config/types';
import Image from 'next/image';

export interface NavbarProps {
  site: SiteConfig;
  activeRoute?: Route;
  /** When true, the navbar starts transparent (over a hero) and turns solid on scroll. */
  transparentOverHero?: boolean;
}

export function Navbar({ site, activeRoute, transparentOverHero = false }: NavbarProps) {
  const [open, setOpen] = useState(false);
  const scrolled = useScrollY(40);
  const isTransparent = transparentOverHero && !scrolled;

  return (
    <>
      <nav
        className={cn(
          'fixed inset-x-0 top-0 z-50 transition-all duration-300 ease-brand',
          isTransparent
            ? 'py-5'
            : 'border-b border-neutral-200 bg-white/95 py-3 shadow-sm backdrop-blur-md',
        )}
      >
        <Container className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md">
              <Image
                height={44}
                width={44}
                src="/images/logo/smpn3kresek-logo.png"
                alt={`Logo ${site.brand.name}`}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="flex flex-col">
              <span
                className={cn(
                  'font-heading text-[15px] font-bold leading-tight transition-colors',
                  isTransparent ? 'text-white' : 'text-neutral-900',
                )}
              >
                {site.brand.name}
              </span>
              <span
                className={cn(
                  'text-[11px] leading-none transition-colors',
                  isTransparent ? 'text-white/70' : 'text-neutral-400',
                )}
              >
                {site.brand.location}
              </span>
            </div>
          </Link>

          <ul className="ml-auto hidden items-center gap-1 lg:flex">
            {site.navigation.map((item) => {
              const isActive = item.href === activeRoute;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'relative rounded-sm px-3.5 py-2 text-sm font-medium transition-colors',
                      isTransparent
                        ? 'text-white/85 hover:bg-white/15 hover:text-white'
                        : 'text-neutral-700 hover:bg-primary-bg hover:text-primary',
                      isActive &&
                        (isTransparent ? 'font-semibold text-white' : 'font-semibold text-primary'),
                    )}
                  >
                    {item.label}
                    {isActive ? (
                      <span
                        aria-hidden
                        className={cn(
                          'absolute bottom-1 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded',
                          isTransparent ? 'bg-white' : 'bg-primary',
                        )}
                      />
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* <Link
            href={site.kontakCta.href}
            className="hidden whitespace-nowrap rounded-sm bg-secondary px-5 py-2.5 font-heading text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[#D97706] hover:shadow-md lg:inline-block"
          >
            {site.kontakCta.label}
          </Link> */}

          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
            className="ml-auto flex flex-col gap-1.5 p-2 lg:hidden"
          >
            <span
              className={cn(
                'block h-0.5 w-5 rounded',
                isTransparent ? 'bg-white' : 'bg-neutral-700',
              )}
            />
            <span
              className={cn(
                'block h-0.5 w-5 rounded',
                isTransparent ? 'bg-white' : 'bg-neutral-700',
              )}
            />
            <span
              className={cn(
                'block h-0.5 w-5 rounded',
                isTransparent ? 'bg-white' : 'bg-neutral-700',
              )}
            />
          </button>
        </Container>
      </nav>

      {open ? (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-2 bg-white/98 px-6 pb-10 pt-20 backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="absolute right-6 top-5 text-2xl text-neutral-700"
          >
            ✕
          </button>
          {site.navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="w-full rounded-md py-3 text-center font-heading text-2xl font-bold text-neutral-800 transition-colors hover:bg-primary-bg hover:text-primary"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href={site.kontakCta.href}
            onClick={() => setOpen(false)}
            className="mt-3 w-full rounded-md bg-secondary py-3 text-center font-heading text-lg font-semibold text-white"
          >
            {site.kontakCta.label} →
          </Link>
        </div>
      ) : null}
    </>
  );
}
