import type { ContentProvider } from './ContentProvider';
import { getSiteConfig } from './repositories/site-repo';
import { assembleHome } from './assemblers/home';
import { assembleProfile } from './assemblers/profil';
import { assembleAcademic } from './assemblers/akademik';
import { assembleFacilities } from './assemblers/fasilitas';
import { assembleContact } from './assemblers/kontak';
import { getAllMading, getMadingById as getMadingByIdRepo } from './repositories/mading-repo';

/**
 * Phase 1: reads all content from MySQL via Prisma.
 * Activated by setting NEXT_PUBLIC_DATA_SOURCE=api in env.
 */
export class ApiContentProvider implements ContentProvider {
  getSiteConfig() { return getSiteConfig(); }
  getHomePage() { return assembleHome(); }
  getProfilePage() { return assembleProfile(); }
  getAcademicPage() { return assembleAcademic(); }
  getFacilitiesPage() { return assembleFacilities(); }
  getContactPage() { return assembleContact(); }
  getMadingList() { return getAllMading(); }
  getMadingById(id: string) { return getMadingByIdRepo(id); }
}
