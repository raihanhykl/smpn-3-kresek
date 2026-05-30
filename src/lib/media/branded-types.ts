/**
 * Phase 3 brand: `CloudinaryCachedUrl` marks a string as the cached `url`
 * column on `MediaAsset`. The brand is structural (assignable to and from
 * `string`) but the only public constructor is `toCachedUrl(...)`, which
 * forces a contributor to think before round-tripping a cached URL through
 * render code instead of going through `cldUrl(publicId, variant)`.
 *
 * This is documentation more than enforcement — by convention, render code
 * resolves URLs via `cldUrl()` so a handover to a different Cloudinary
 * account is one env-var swap, never a per-row URL rewrite. The brand keeps
 * that convention visible at the type level. See:
 *   docs/superpowers/specs/2026-05-30-phase-3-storage-and-handover.md
 */

declare const cloudinaryCachedUrlBrand: unique symbol;

export type CloudinaryCachedUrl = string & { readonly [cloudinaryCachedUrlBrand]: true };

/**
 * Construct a CloudinaryCachedUrl. The only sanctioned call sites are:
 *  - `/api/media/confirm` (writes the cache fresh from Cloudinary's response)
 *  - `media-repo.toPublic(row)` (echoes the cache back to clients)
 *
 * Render code should call `cldUrl(publicId, variant)` instead.
 */
export function toCachedUrl(s: string): CloudinaryCachedUrl {
  return s as CloudinaryCachedUrl;
}
