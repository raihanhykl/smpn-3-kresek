/**
 * Maps a server-action error code/message to a friendly Indonesian message
 * for display in admin forms. The withRole guard returns 'unauthorized',
 * 'forbidden', 'not_found', 'unknown_error', or a ZodError's first issue message.
 */
export function mapActionError(error: string): string {
  switch (error) {
    case 'forbidden':
      return 'Anda tidak punya izin untuk melakukan ini.';
    case 'unauthorized':
      return 'Sesi Anda berakhir. Silakan masuk kembali.';
    case 'not_found':
      return 'Data tidak ditemukan — mungkin sudah diubah atau dihapus. Muat ulang halaman lalu coba lagi.';
    case 'unknown_error':
      return 'Terjadi kesalahan. Silakan coba lagi.';
    default:
      // Already-friendly Zod validation message (e.g. "Nama wajib diisi").
      return error;
  }
}
