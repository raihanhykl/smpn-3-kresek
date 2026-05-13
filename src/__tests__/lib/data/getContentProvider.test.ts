import {
  getContentProvider,
  resetContentProviderCache,
  StaticContentProvider,
  ApiContentProvider,
} from '@lib/data';

const ORIGINAL_SOURCE = process.env.NEXT_PUBLIC_DATA_SOURCE;
const ORIGINAL_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

afterEach(() => {
  process.env.NEXT_PUBLIC_DATA_SOURCE = ORIGINAL_SOURCE;
  process.env.NEXT_PUBLIC_API_BASE_URL = ORIGINAL_BASE;
  resetContentProviderCache();
});

describe('getContentProvider factory', () => {
  it('returns a StaticContentProvider by default', () => {
    delete process.env.NEXT_PUBLIC_DATA_SOURCE;
    resetContentProviderCache();
    expect(getContentProvider()).toBeInstanceOf(StaticContentProvider);
  });

  it('returns an ApiContentProvider when NEXT_PUBLIC_DATA_SOURCE=api', () => {
    process.env.NEXT_PUBLIC_DATA_SOURCE = 'api';
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.example.com';
    resetContentProviderCache();
    expect(getContentProvider()).toBeInstanceOf(ApiContentProvider);
  });

  it('caches the provider across calls', () => {
    resetContentProviderCache();
    const a = getContentProvider();
    const b = getContentProvider();
    expect(a).toBe(b);
  });
});

describe('StaticContentProvider', () => {
  const provider = new StaticContentProvider();

  it('returns the typed site config', async () => {
    const site = await provider.getSiteConfig();
    expect(site.brand.name).toBe('SMPN 3 Kresek');
    expect(site.navigation).toHaveLength(5);
  });

  it('returns the home page config with all sections', async () => {
    const home = await provider.getHomePage();
    expect(home.hero.titleLine2).toBe('SMPN 3 Kresek');
    expect(home.stats.cards.length).toBeGreaterThan(0);
    expect(home.programs.cards.length).toBeGreaterThan(0);
    expect(home.gallery.items.length).toBeGreaterThan(0);
    expect(home.achievements.items.length).toBeGreaterThan(0);
  });

  it('returns all 5 page configs without throwing', async () => {
    await expect(provider.getProfilePage()).resolves.toBeDefined();
    await expect(provider.getAcademicPage()).resolves.toBeDefined();
    await expect(provider.getFacilitiesPage()).resolves.toBeDefined();
    await expect(provider.getContactPage()).resolves.toBeDefined();
  });
});

describe('ApiContentProvider', () => {
  const provider = new ApiContentProvider('https://api.example.com');

  it('throws "not implemented" on every method', async () => {
    await expect(provider.getSiteConfig()).rejects.toThrow(/not implemented/);
    await expect(provider.getHomePage()).rejects.toThrow(/not implemented/);
    await expect(provider.getProfilePage()).rejects.toThrow(/not implemented/);
    await expect(provider.getAcademicPage()).rejects.toThrow(/not implemented/);
    await expect(provider.getFacilitiesPage()).rejects.toThrow(/not implemented/);
    await expect(provider.getContactPage()).rejects.toThrow(/not implemented/);
  });
});
