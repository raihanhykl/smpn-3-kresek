/**
 * @jest-environment node
 */
import { signCloudinaryUpload } from '@/lib/media/cloudinary-sign';

describe('signCloudinaryUpload (stub gate)', () => {
  it('returns a deterministic stub when NODE_ENV is "test"', () => {
    // jest sets NODE_ENV='test' automatically.
    expect(process.env.NODE_ENV).toBe('test');
    const r = signCloudinaryUpload({
      publicId: 'smpn3kresek/image/abc',
      folder: 'smpn3kresek/image',
      timestamp: 1700000000,
      resourceType: 'image',
    });
    expect(r).toEqual({ signature: 'stub-signature-smpn3kresek/image/abc', apiKey: 'test-key' });
  });

  it('returns a different stub signature per publicId', () => {
    const a = signCloudinaryUpload({ publicId: 'pid-A', folder: 'x', timestamp: 1, resourceType: 'image' });
    const b = signCloudinaryUpload({ publicId: 'pid-B', folder: 'x', timestamp: 1, resourceType: 'image' });
    expect(a.signature).not.toBe(b.signature);
  });

  it('throws (does NOT silently succeed) when NODE_ENV is not "test"', () => {
    const original = process.env.NODE_ENV;
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', configurable: true });
    try {
      expect(() => signCloudinaryUpload({
        publicId: 'x', folder: 'x', timestamp: 0, resourceType: 'image',
      })).toThrow(/Cloudinary signer is not wired yet/);
    } finally {
      Object.defineProperty(process.env, 'NODE_ENV', { value: original, configurable: true });
    }
  });
});
