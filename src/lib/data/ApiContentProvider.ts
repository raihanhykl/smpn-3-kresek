import type { ContentProvider } from './ContentProvider';

/**
 * Stub for a future backend implementation.
 *
 * When the Node/Express/Prisma/Postgres backend is built, replace each
 * `notImplemented()` call with a real fetch to `${this.baseUrl}/...` and
 * map the response into the typed page-config shape.
 *
 * Activated by setting `NEXT_PUBLIC_DATA_SOURCE=api` and providing
 * `NEXT_PUBLIC_API_BASE_URL`. See README → "Future backend integration".
 */
export class ApiContentProvider implements ContentProvider {
  constructor(private readonly baseUrl: string) {}

  private notImplemented(method: string): never {
    throw new Error(
      `ApiContentProvider.${method} is not implemented yet. Set NEXT_PUBLIC_DATA_SOURCE=static or implement the API client.`,
    );
  }

  async getSiteConfig() {
    return this.notImplemented('getSiteConfig');
  }
  async getHomePage() {
    return this.notImplemented('getHomePage');
  }
  async getProfilePage() {
    return this.notImplemented('getProfilePage');
  }
  async getAcademicPage() {
    return this.notImplemented('getAcademicPage');
  }
  async getFacilitiesPage() {
    return this.notImplemented('getFacilitiesPage');
  }
  async getContactPage() {
    return this.notImplemented('getContactPage');
  }
}
