import { siteConfig } from '@config/site';
import type { ContentProvider } from './ContentProvider';
import { assembleHome } from './assemblers/home';
import { assembleProfile } from './assemblers/profil';
import { assembleAcademic } from './assemblers/akademik';
import { assembleFacilities } from './assemblers/fasilitas';
import { assembleContact } from './assemblers/kontak';
import { getAllMading, getMadingById as getMadingByIdRepo } from './repositories/mading-repo';

/**
 * Reads page content in `api` mode: section TEXT + site config + navigation come
 * straight from src/config/ (edit code = instant change); entity lists and the 6
 * section photos are merged from the DB inside the assemblers.
 * Activated by NEXT_PUBLIC_DATA_SOURCE=api.
 */
export class ApiContentProvider implements ContentProvider {
  // SiteConfig (brand/social/kontakCta/accreditation/footer) + embedded navigation
  // are static config now — same object the StaticContentProvider returns.
  async getSiteConfig() { return siteConfig; }
  getHomePage() { return assembleHome(); }
  getProfilePage() { return assembleProfile(); }
  getAcademicPage() { return assembleAcademic(); }
  getFacilitiesPage() { return assembleFacilities(); }
  getContactPage() { return assembleContact(); }
  getMadingList() { return getAllMading(); }
  getMadingById(id: string) { return getMadingByIdRepo(id); }
}
