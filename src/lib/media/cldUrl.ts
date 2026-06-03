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

/**
 * `transform` is the NO-CROP transform (unchanged Phase 3 behaviour — c_fill to
 * a fixed box). `width` is the target delivery width used ONLY when a crop is
 * present: a crop already defines the final aspect ratio (it matches the
 * entity's container), so we must NOT re-fill it to the variant's box. Instead
 * we c_scale to `width` and let the crop's own ratio stand. `width: null` means
 * the variant has no meaningful width (pdf / original) and ignores crop sizing.
 */
export const CLD_VARIANTS: Record<
  CldVariant,
  { resourceType: 'image' | 'raw'; transform: string; width: number | null }
> = {
  avatar: { resourceType: 'image', transform: 'c_fill,g_face,w_200,h_200,f_auto,q_auto', width: 400 },
  card: { resourceType: 'image', transform: 'c_fill,w_640,h_400,f_auto,q_auto', width: 640 },
  hero: { resourceType: 'image', transform: 'c_fill,w_1600,h_900,f_auto,q_auto', width: 1600 },
  original: { resourceType: 'image', transform: 'f_auto,q_auto', width: null },
  pdf: { resourceType: 'raw', transform: '', width: null },
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
 * decimals map 1:1 to react-easy-crop's croppedArea fractions.
 *
 * CROP vs FILL — the load-bearing rule (Phase 4 bugfix):
 * The admin crops inside a frame locked to the ENTITY'S container ratio, so a
 * stored crop already has the final aspect ratio. The variant's `c_fill,w,h`
 * uses a DIFFERENT ratio (card 3:2, hero 16:9), so chaining
 * `c_crop → c_fill,w,h` would re-crop the admin's region to the variant ratio,
 * and the browser's `object-cover` would then crop it a THIRD time — producing
 * the "more zoomed / not proportional" bug.
 * Fix: when a crop is present, emit `c_crop,<region> → c_scale,w_<width>` —
 * scale to width only, preserving the crop's own ratio. The browser container
 * (same ratio) then needs no further cropping. When NO crop is present we keep
 * the original `c_fill` behaviour unchanged (no regression for legacy photos).
 */
export function cldUrl(
  publicId: string,
  variant: CldVariant = 'original',
  crop?: CldCrop,
): string {
  const cloud = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const { resourceType, transform, width } = CLD_VARIANTS[variant];
  const base = `https://res.cloudinary.com/${cloud}/${resourceType}/upload`;

  const cropValid =
    !!crop && [crop.x, crop.y, crop.w, crop.h].every((n) => typeof n === 'number' && Number.isFinite(n));

  if (cropValid) {
    const cropSeg = `c_crop,x_${crop!.x},y_${crop!.y},w_${crop!.w},h_${crop!.h}`;
    // Preserve the crop's aspect ratio: scale to the variant's target width
    // (not c_fill to its box). f_auto,q_auto keep delivery optimised.
    const sizeSeg = width !== null ? `c_scale,w_${width},f_auto,q_auto` : 'f_auto,q_auto';
    return `${base}/${cropSeg}/${sizeSeg}/${publicId}`;
  }

  // No crop → unchanged Phase 3 behaviour.
  return transform ? `${base}/${transform}/${publicId}` : `${base}/${publicId}`;
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
