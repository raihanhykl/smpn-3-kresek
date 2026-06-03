import { siteConfig } from '@config/site';
import { homePageConfig } from '@config/pages/home';
import { profilPageConfig } from '@config/pages/profil';
import { akademikPageConfig } from '@config/pages/akademik';
import { fasilitasPageConfig } from '@config/pages/fasilitas';
import { kontakPageConfig } from '@config/pages/kontak';
import type { Mading } from '@config/types';
import type { ContentProvider } from './ContentProvider';

export class StaticContentProvider implements ContentProvider {
  async getSiteConfig() {
    return siteConfig;
  }
  async getHomePage() {
    return homePageConfig;
  }
  async getProfilePage() {
    return profilPageConfig;
  }
  async getAcademicPage() {
    return akademikPageConfig;
  }
  async getFacilitiesPage() {
    return fasilitasPageConfig;
  }
  async getContactPage() {
    return kontakPageConfig;
  }
  async getMadingList(): Promise<Mading[]> {
    return [];
  }
  async getMadingById(): Promise<Mading | null> {
    return null;
  }
}
