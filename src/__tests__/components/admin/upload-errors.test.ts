/**
 * @jest-environment node
 */
import { UPLOAD_ERROR_COPY, uploadErrorMessage } from '@/components/admin/media/upload-errors';

describe('uploadErrorMessage', () => {
  it('maps a known code to its Indonesian copy', () => {
    expect(uploadErrorMessage('unauthorized')).toBe(UPLOAD_ERROR_COPY.unauthorized);
    expect(uploadErrorMessage('too_large')).toBe(UPLOAD_ERROR_COPY.too_large);
    expect(uploadErrorMessage('cloudinary_failed')).toBe(UPLOAD_ERROR_COPY.cloudinary_failed);
  });

  it('falls back to unknown_error for an unrecognized code', () => {
    expect(uploadErrorMessage('something_new')).toBe(UPLOAD_ERROR_COPY.unknown_error);
  });

  it('falls back to unknown_error for null/undefined/empty', () => {
    expect(uploadErrorMessage(null)).toBe(UPLOAD_ERROR_COPY.unknown_error);
    expect(uploadErrorMessage(undefined)).toBe(UPLOAD_ERROR_COPY.unknown_error);
    expect(uploadErrorMessage('')).toBe(UPLOAD_ERROR_COPY.unknown_error);
  });

  it('every value is a non-empty Indonesian string', () => {
    for (const [k, v] of Object.entries(UPLOAD_ERROR_COPY)) {
      expect(typeof v).toBe('string');
      expect(v.length).toBeGreaterThan(0);
      // sanity check: at least one ASCII letter so the table isn't a typo.
      expect(/[A-Za-z]/.test(v)).toBe(true);
      expect(k.length).toBeGreaterThan(0);
    }
  });
});
