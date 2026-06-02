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
 * Phase 4 crop region — normalized 0–1 fractions of the source image.
 * Cloudinary's c_crop accepts these as percentage-based coordinates directly,
 * so no MediaAsset width/height lookup is needed.
 */
export type CldCrop = { x: number; y: number; w: number; h: number };

/**
 * Build a Cloudinary URL for a stored `publicId` at the chosen variant, with an
 * optional crop region applied first.
 * Caller must pass a Cloudinary publicId (no leading slash, no `://`).
 * Validation of that shape lives in `photoSchema`.
 *
 * Crop coordinates are Cloudinary PERCENTAGE-BASED (0–1) fractions:
 * `c_crop,x_,y_,w_,h_`. Cloudinary requires ALL FOUR to be percentage-based
 * together — we emit all four or none, never mixed with pixel coords. The
 * decimals map 1:1 to react-easy-crop's croppedArea fractions. Crop MUST come
 * BEFORE the variant's c_fill (Cloudinary applies chained transforms
 * left-to-right: crop the region first, then fit it to the variant box).
 */
export function cldUrl(
  publicId: string,
  variant: CldVariant = 'original',
  crop?: CldCrop,
): string {
  const cloud = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const { resourceType, transform } = CLD_VARIANTS[variant];
  const base = `https://res.cloudinary.com/${cloud}/${resourceType}/upload`;

  const cropValid =
    !!crop && [crop.x, crop.y, crop.w, crop.h].every((n) => typeof n === 'number' && Number.isFinite(n));
  const cropSeg = cropValid
    ? `c_crop,x_${crop!.x},y_${crop!.y},w_${crop!.w},h_${crop!.h}`
    : '';

  // The avatar variant's g_face gravity assumes a full image; once the admin has
  // chosen an explicit crop the focus is already defined, and g_face may fail to
  // find a face in the pre-cropped output. So drop g_face when a crop is present.
  const effectiveTransform =
    cropValid && variant === 'avatar' ? transform.replace('g_face,', '') : transform;

  const segments = [cropSeg, effectiveTransform].filter(Boolean).join('/');
  return segments ? `${base}/${segments}/${publicId}` : `${base}/${publicId}`;
}

/**
 * Extract a CldCrop from a url Photo, or undefined if it isn't fully cropped.
 * The all-or-nothing guard means a half-defined crop never reaches the URL.
 */
export function cropOf(photo: {
  cropX?: number | undefined;
  cropY?: number | undefined;
  cropW?: number | undefined;
  cropH?: number | undefined;
}): CldCrop | undefined {
  const { cropX, cropY, cropW, cropH } = photo;
  if (cropX === undefined || cropY === undefined || cropW === undefined || cropH === undefined) {
    return undefined;
  }
  return { x: cropX, y: cropY, w: cropW, h: cropH };
}
