import type { ReactNode } from 'react';
import { Navbar } from '@components/organisms/Navbar';
import { Footer } from '@components/organisms/Footer';
import { BackToTop } from '@components/organisms/BackToTop';
import type { SiteConfig, Route } from '@config/types';

export interface PageLayoutProps {
  children: ReactNode;
  site: SiteConfig;
  activeRoute: Route;
  transparentOverHero?: boolean;
}

export function PageLayout({ children, site, activeRoute, transparentOverHero = false }: PageLayoutProps) {
  return (
    // Sticky-footer layout: the column fills at least the viewport and <main>
    // grows to take the slack, so the footer rests at the bottom of the screen
    // when content is short (no forced scroll) and flows below it when content
    // is tall. Pages must NOT add their own min-h-screen — that would double the
    // height and push the footer off-screen.
    <div className="flex min-h-screen flex-col">
      <Navbar site={site} activeRoute={activeRoute} transparentOverHero={transparentOverHero} />
      <main className="flex-1">{children}</main>
      <Footer site={site} />
      <BackToTop />
    </div>
  );
}
