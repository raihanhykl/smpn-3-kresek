import type {
  SiteConfig,
  HomePageConfig,
  ProfilePageConfig,
  AcademicPageConfig,
  FacilitiesPageConfig,
  ContactPageConfig,
  Mading,
} from '@config/types';

/**
 * Single read-side interface for all page content.
 *
 * Two implementations live alongside this file:
 *   - StaticContentProvider — wraps the typed configs under src/config/
 *   - ApiContentProvider    — future backend stub (not implemented yet)
 *
 * Add new methods here when you add a new page or entity, so both
 * implementations stay in sync.
 */
export interface ContentProvider {
  getSiteConfig(): Promise<SiteConfig>;
  getHomePage(): Promise<HomePageConfig>;
  getProfilePage(): Promise<ProfilePageConfig>;
  getAcademicPage(): Promise<AcademicPageConfig>;
  getFacilitiesPage(): Promise<FacilitiesPageConfig>;
  getContactPage(): Promise<ContactPageConfig>;
  getMadingList(): Promise<Mading[]>;
  getMadingById(id: string): Promise<Mading | null>;
}
