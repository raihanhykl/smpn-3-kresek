/**
 * Phase 3 file-upload limits. Single source of truth for sign-upload + confirm
 * endpoints AND the client-side preflight. Tightening these is a config change,
 * never a code change in the route.
 *
 * `cldFormats` is what Cloudinary reports back in its upload response. We use
 * it as the "magic bytes surrogate" in /api/media/confirm: Cloudinary refuses
 * to label a renamed .exe as image/jpeg, so a successful upload whose
 * reported format matches the declared MIME is equivalent to magic-byte
 * validation for our threat model (school admins, not anonymous attackers).
 */
export const MEDIA_LIMITS = {
  image: {
    maxBytes: 5 * 1024 * 1024, //  5 MB
    mimes: ['image/jpeg', 'image/png', 'image/webp'] as const,
    cldFormats: ['jpg', 'jpeg', 'png', 'webp'] as const,
  },
  pdf: {
    maxBytes: 10 * 1024 * 1024, // 10 MB
    mimes: ['application/pdf'] as const,
    cldFormats: ['pdf'] as const,
  },
} as const;

export type MediaKind = keyof typeof MEDIA_LIMITS;
