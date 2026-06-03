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

  it('uses the live Cloudinary SDK signer when NODE_ENV is NOT "test" (Chunk 9 wiring)', () => {
    // Mock the cloudinary module so the live branch is exercised without
    // depending on a real API_SECRET or network. The jest module cache must
    // be reset so the live-branch import picks up the mock.
    jest.resetModules();
    jest.doMock('cloudinary', () => ({
      v2: {
        utils: {
          api_sign_request: (params: Record<string, unknown>, secret: string) =>
            `LIVE-${JSON.stringify(params)}-${secret.slice(0, 4)}`,
        },
      },
    }));
    const original = process.env.NODE_ENV;
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', configurable: true });
    try {
      const live = require('@/lib/media/cloudinary-sign') as typeof import('@/lib/media/cloudinary-sign');
      const r = live.signCloudinaryUpload({
        publicId: 'smpn3kresek/image/live',
        folder: 'smpn3kresek/image',
        timestamp: 12345,
        resourceType: 'image',
      });
      expect(r.signature).toContain('LIVE-');
      expect(r.signature).toContain('"public_id":"smpn3kresek/image/live"');
      expect(r.signature).toContain('"timestamp":12345');
      expect(r.apiKey).toBe('test-key'); // CLOUDINARY_API_KEY from jest.setup.ts
    } finally {
      Object.defineProperty(process.env, 'NODE_ENV', { value: original, configurable: true });
      jest.dontMock('cloudinary');
      jest.resetModules();
    }
  });
});
