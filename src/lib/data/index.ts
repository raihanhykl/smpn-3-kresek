import type { ContentProvider } from './ContentProvider';
import { StaticContentProvider } from './StaticContentProvider';
import { ApiContentProvider } from './ApiContentProvider';

export type { ContentProvider } from './ContentProvider';
export { StaticContentProvider } from './StaticContentProvider';
export { ApiContentProvider } from './ApiContentProvider';

let cached: ContentProvider | null = null;

/**
 * Returns the content provider configured by `NEXT_PUBLIC_DATA_SOURCE`.
 *
 *  - `static` (default): reads from typed configs under src/config/.
 *  - `api`: future backend implementation. Currently throws on every call.
 *
 * Cached for the lifetime of the process. Tests can reset via `resetContentProviderCache()`.
 */
export function getContentProvider(): ContentProvider {
  if (cached) return cached;
  const source = process.env.NEXT_PUBLIC_DATA_SOURCE ?? 'static';
  cached =
    source === 'api'
      ? new ApiContentProvider()
      : new StaticContentProvider();
  return cached;
}

export function resetContentProviderCache(): void {
  cached = null;
}
