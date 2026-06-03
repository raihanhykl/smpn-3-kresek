/**
 * @jest-environment jsdom
 */
import { uploadToCloudinary, UploadError } from '@/components/admin/media/uploadToCloudinary';

// crypto.subtle is provided by jsdom in modern jest envs; verify by computing
// a known hash. If absent, polyfill via node's webcrypto.
import { webcrypto } from 'node:crypto';
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

// Minimal PublicMediaAsset for assertions
function makeMedia(id: string) {
  return {
    id, kind: 'image' as const,
    url: 'https://res.cloudinary.com/test-cloud/image/upload/' + id,
    publicId: 'smpn3kresek/image/' + id,
    alt: null, filename: id + '.jpg', sizeBytes: 100, mimeType: 'image/jpeg',
    width: null, height: null,
  };
}

function mockFetch(handlers: Record<string, (init?: RequestInit) => Promise<{ ok: boolean; status?: number; json: () => Promise<unknown> }>>) {
  const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
    for (const [pattern, handler] of Object.entries(handlers)) {
      if (url.includes(pattern)) return handler(init);
    }
    return { ok: false, status: 404, json: () => Promise.resolve({}) };
  });
  (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;
  return fetchMock;
}

function makeFile(name: string, type: string, size: number, content?: Uint8Array) {
  const bytes = content ?? new Uint8Array(size);
  // BlobPart accepts ArrayBuffer; pass a fresh one so TS's ArrayBufferLike
  // narrowing doesn't flag the Uint8Array.buffer (which may be
  // SharedArrayBufferLike depending on lib.dom.d.ts version).
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  // jsdom's File does not implement .arrayBuffer(); polyfill it on the instance
  // so sha256Hex can compute the digest.
  const file = new File([ab], name, { type });
  Object.defineProperty(file, 'arrayBuffer', {
    value: async () => ab,
    configurable: true,
  });
  return file;
}

describe('uploadToCloudinary', () => {
  beforeEach(() => {
    delete (global as unknown as { fetch?: unknown }).fetch;
  });

  it('rejects preflight on oversize image (no network)', async () => {
    const fetchMock = mockFetch({});
    const big = makeFile('big.jpg', 'image/jpeg', 6 * 1024 * 1024);
    await expect(uploadToCloudinary(big, 'image')).rejects.toEqual(
      expect.objectContaining({ code: 'preflight_too_large' }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects preflight on disallowed mime (no network)', async () => {
    const fetchMock = mockFetch({});
    const f = makeFile('x.gif', 'image/gif', 1024);
    await expect(uploadToCloudinary(f, 'image')).rejects.toEqual(
      expect.objectContaining({ code: 'preflight_wrong_type' }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns reused media when /sign-upload says { reused: true } (no Cloudinary call)', async () => {
    const existing = makeMedia('reused-id');
    const fetchMock = mockFetch({
      '/api/media/sign-upload': async () => ({ ok: true, json: async () => ({ reused: true, media: existing }) }),
    });
    const f = makeFile('small.jpg', 'image/jpeg', 1024);
    const got = await uploadToCloudinary(f, 'image');
    expect(got).toEqual(existing);
    // No upload nor confirm call.
    const urls = fetchMock.mock.calls.map((c) => c[0]);
    expect(urls.some((u) => String(u).includes('api.cloudinary.com'))).toBe(false);
    expect(urls.some((u) => String(u).includes('/api/media/confirm'))).toBe(false);
  });

  it('happy path: sign → cloudinary upload → confirm → returns media', async () => {
    const confirmed = makeMedia('fresh-id');
    const fetchMock = mockFetch({
      '/api/media/sign-upload': async () => ({
        ok: true,
        json: async () => ({
          reused: false, cloudName: 'test-cloud', apiKey: 'test-key', timestamp: 123,
          signature: 'sig', publicId: 'smpn3kresek/image/aaa', folder: 'smpn3kresek/image',
          resourceType: 'image', uploadUrl: 'https://api.cloudinary.com/v1_1/test-cloud/image/upload',
        }),
      }),
      'api.cloudinary.com': async () => ({
        ok: true,
        json: async () => ({
          public_id: 'smpn3kresek/image/aaa',
          secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/v1/smpn3kresek/image/aaa.jpg',
          bytes: 1024, format: 'jpg', resource_type: 'image',
          original_filename: 'fresh', signature: 'cld-sig', width: 200, height: 200,
        }),
      }),
      '/api/media/confirm': async () => ({ ok: true, json: async () => ({ ok: true, media: confirmed }) }),
    });
    const f = makeFile('fresh.jpg', 'image/jpeg', 1024);
    const got = await uploadToCloudinary(f, 'image');
    expect(got).toEqual(confirmed);
    // Sequence: sign → cloudinary → confirm.
    const callOrder = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(callOrder[0]).toContain('/api/media/sign-upload');
    expect(callOrder[1]).toContain('api.cloudinary.com');
    expect(callOrder[2]).toContain('/api/media/confirm');
  });

  it('propagates the api error code when /sign-upload fails', async () => {
    mockFetch({
      '/api/media/sign-upload': async () => ({ ok: false, status: 429, json: async () => ({ error: 'rate_limited' }) }),
    });
    const f = makeFile('x.jpg', 'image/jpeg', 100);
    await expect(uploadToCloudinary(f, 'image')).rejects.toEqual(
      expect.objectContaining({ code: 'rate_limited' }),
    );
  });

  it('maps Cloudinary 5xx to cloudinary_failed', async () => {
    mockFetch({
      '/api/media/sign-upload': async () => ({
        ok: true,
        json: async () => ({
          reused: false, cloudName: 'test-cloud', apiKey: 'test-key', timestamp: 123,
          signature: 'sig', publicId: 'smpn3kresek/image/x', folder: 'smpn3kresek/image',
          resourceType: 'image', uploadUrl: 'https://api.cloudinary.com/v1_1/test-cloud/image/upload',
        }),
      }),
      'api.cloudinary.com': async () => ({ ok: false, status: 500, json: async () => ({}) }),
    });
    const f = makeFile('x.jpg', 'image/jpeg', 100);
    await expect(uploadToCloudinary(f, 'image')).rejects.toEqual(
      expect.objectContaining({ code: 'cloudinary_failed' }),
    );
  });

  it('propagates the api error code when /confirm fails', async () => {
    mockFetch({
      '/api/media/sign-upload': async () => ({
        ok: true,
        json: async () => ({
          reused: false, cloudName: 'test-cloud', apiKey: 'test-key', timestamp: 123,
          signature: 'sig', publicId: 'smpn3kresek/image/x', folder: 'smpn3kresek/image',
          resourceType: 'image', uploadUrl: 'https://api.cloudinary.com/v1_1/test-cloud/image/upload',
        }),
      }),
      'api.cloudinary.com': async () => ({
        ok: true,
        json: async () => ({
          public_id: 'smpn3kresek/image/x',
          secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/v1/x.jpg',
          bytes: 100, format: 'jpg', resource_type: 'image',
          original_filename: 'x', signature: 'cld-sig',
        }),
      }),
      '/api/media/confirm': async () => ({ ok: false, status: 400, json: async () => ({ error: 'forbidden_host' }) }),
    });
    const f = makeFile('x.jpg', 'image/jpeg', 100);
    await expect(uploadToCloudinary(f, 'image')).rejects.toEqual(
      expect.objectContaining({ code: 'forbidden_host' }),
    );
  });

  it('UploadError instances carry the code', () => {
    const e = new UploadError('rate_limited');
    expect(e).toBeInstanceOf(Error);
    expect(e.code).toBe('rate_limited');
    expect(e.name).toBe('UploadError');
  });
});
