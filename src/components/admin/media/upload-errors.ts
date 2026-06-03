/**
 * Phase 3 user-facing error copy for the upload flow.
 *
 * Keys mirror the `error` codes returned by /api/media/sign-upload and
 * /api/media/confirm so the client uploader can pick the right Indonesian
 * message from one place. Codes that don't come from the API (network failure,
 * preflight reject) get their own keys here too.
 *
 * If a code arrives that isn't in the map, the client falls back to
 * `unknown_error`. That keeps unexpected backend changes from leaking raw
 * English to the admin user.
 */
export const UPLOAD_ERROR_COPY: Record<string, string> = {
  // From withApiAuth
  unauthorized: 'Sesi Anda berakhir. Silakan masuk kembali.',
  forbidden: 'Anda tidak punya izin untuk mengunggah.',
  // From upload rate limiter
  rate_limited: 'Terlalu banyak unggahan dalam 1 menit. Coba lagi sebentar.',
  // From Zod parse on either endpoint
  invalid_request: 'Data permintaan tidak valid.',
  // From mime/size guard on /sign-upload
  unsupported_type: 'Format file tidak didukung (gunakan JPG/PNG/WebP atau PDF).',
  too_large: 'Ukuran berkas melebihi batas (maks 5MB untuk foto, 10MB untuk PDF).',
  // From /confirm
  forbidden_host: 'Berkas tidak diunggah ke penyimpanan resmi sekolah.',
  format_mismatch: 'Format file tidak sesuai dengan tipe yang dipilih.',
  resource_type_mismatch: 'Tipe penyimpanan tidak sesuai.',
  // Client-side preflight / network
  preflight_too_large: 'Ukuran berkas melebihi batas (maks 5MB untuk foto, 10MB untuk PDF).',
  preflight_wrong_type: 'Format file tidak didukung (gunakan JPG/PNG/WebP atau PDF).',
  cloudinary_failed: 'Penyimpanan media bermasalah. Coba lagi sebentar lagi.',
  network_error: 'Gagal mengunggah berkas. Periksa koneksi Anda dan coba lagi.',
  // Fallback
  unknown_error: 'Terjadi kesalahan. Silakan coba lagi.',
};

export function uploadErrorMessage(code: string | undefined | null): string {
  if (!code) return UPLOAD_ERROR_COPY.unknown_error!;
  return UPLOAD_ERROR_COPY[code] ?? UPLOAD_ERROR_COPY.unknown_error!;
}
