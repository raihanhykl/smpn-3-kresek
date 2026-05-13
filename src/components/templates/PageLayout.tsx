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
    <>
      <Navbar site={site} activeRoute={activeRoute} transparentOverHero={transparentOverHero} />
      <main>{children}</main>
      <Footer site={site} />
      <BackToTop />
    </>
  );
}
