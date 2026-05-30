import { env } from '@/lib/env';

/**
 * Render-time Cloudinary URL builder. The cloud name comes from
 * `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, NOT from any DB row — so a handover to
 * a different Cloudinary account is a single env-var swap.
 *
 * Why a pure string builder (no Cloudinary SDK):
 * - Edge/RSC safe — no runtime dep, no bundle bloat.
 * - Variants live in code, not DB, so re-tuning transformations is a code change.
 *
 * Variants:
 *   avatar    teacher photos                    image  c_fill,g_face,200x200
 *   card      gallery / library thumbnails      image  c_fill,640x400
 *   hero      large page banners                image  c_fill,1600x900
 *   original  unconstrained, auto format/qual   image  f_auto,q_auto
 *   pdf       PDF download link                 raw    no transform
 */

export type CldVariant = 'avatar' | 'card' | 'hero' | 'pdf' | 'original';

export const CLD_VARIANTS: Record<
  CldVariant,
  { resourceType: 'image' | 'raw'; transform: string }
> = {
  avatar: { resourceType: 'image', transform: 'c_fill,g_face,w_200,h_200,f_auto,q_auto' },
  card: { resourceType: 'image', transform: 'c_fill,w_640,h_400,f_auto,q_auto' },
  hero: { resourceType: 'image', transform: 'c_fill,w_1600,h_900,f_auto,q_auto' },
  original: { resourceType: 'image', transform: 'f_auto,q_auto' },
  pdf: { resourceType: 'raw', transform: '' },
};

/**
 * Build a Cloudinary URL for a stored `publicId` at the chosen variant.
 * Caller must pass a Cloudinary publicId (no leading slash, no `://`).
 * Validation of that shape lives in `photoSchema` (Chunk 1.5).
 */
export function cldUrl(publicId: string, variant: CldVariant = 'original'): string {
  const cloud = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const { resourceType, transform } = CLD_VARIANTS[variant];
  const base = `https://res.cloudinary.com/${cloud}/${resourceType}/upload`;
  return transform ? `${base}/${transform}/${publicId}` : `${base}/${publicId}`;
}
