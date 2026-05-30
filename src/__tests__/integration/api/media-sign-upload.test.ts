import { prisma } from '@/lib/db/client';
import { uploadRateLimiter } from '@/lib/media/upload-rate-limit';

// Mock getSession to control auth without a real NextAuth session.
jest.mock('@/lib/auth/session', () => ({ getSession: jest.fn() }));
import { getSession } from '@/lib/auth/session';
const mockSession = getSession as jest.Mock;

// Import the route after the mock is set up.
import { POST } from '@/app/api/media/sign-upload/route';
import { createMediaAsset } from '@/lib/data/repositories/media-repo';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

function makeReq(body: unknown, ip = '1.1.1.1'): import('next/server').NextRequest {
  const req = new Request('http://localhost/api/media/sign-upload', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
  return req as unknown as import('next/server').NextRequest;
}

const goodBody = {
  kind: 'image' as const,
  mimeType: 'image/jpeg',
  sizeBytes: 200_000,
  sha256Hex: HASH_A,
  filename: 'pak-budi.jpg',
};

describe('POST /api/media/sign-upload', () => {
  beforeEach(() => {
    uploadRateLimiter.resetForTests();
    mockSession.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });
  });
  afterEach(() => {
    mockSession.mockReset();
  });
  beforeAll(async () => { await prisma.mediaAsset.deleteMany({}); });
  afterAll(async () => { await prisma.mediaAsset.deleteMany({}); await prisma.$disconnect(); });

  it('401 when no session', async () => {
    mockSession.mockResolvedValue(null);
    const res = await POST(makeReq(goodBody));
    expect(res.status).toBe(401);
  });

  it('400 invalid_request when hash is malformed', async () => {
    const res = await POST(makeReq({ ...goodBody, sha256Hex: 'short' }));
    expect(res.status).toBe(400);
    const j = await res.json();
    expect(j.error).toBe('invalid_request');
  });

  it('415 unsupported_type when mime not in allowlist', async () => {
    const res = await POST(makeReq({ ...goodBody, mimeType: 'image/gif' }));
    expect(res.status).toBe(415);
    expect((await res.json()).error).toBe('unsupported_type');
  });

  it('413 too_large when sizeBytes exceeds limit', async () => {
    const res = await POST(makeReq({ ...goodBody, sizeBytes: 6 * 1024 * 1024 }));
    expect(res.status).toBe(413);
    expect((await res.json()).error).toBe('too_large');
  });

  it('returns reused=true and skips signing when the hash already exists', async () => {
    await createMediaAsset({
      kind: 'image', url: 'https://res.cloudinary.com/test-cloud/image/upload/v1/x.jpg',
      publicId: 'smpn3kresek/image/' + HASH_A.slice(0, 16), hash: HASH_A,
      alt: null, filename: 'x.jpg', sizeBytes: 200_000, mimeType: 'image/jpeg',
      width: null, height: null, uploadedBy: 'seed',
    });
    const res = await POST(makeReq(goodBody));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.reused).toBe(true);
    expect(j.media.publicId).toBe('smpn3kresek/image/' + HASH_A.slice(0, 16));
    // Cleanup so other tests start clean.
    await prisma.mediaAsset.deleteMany({});
  });

  it('returns reused=false and a stub signature when hash is new', async () => {
    const res = await POST(makeReq({ ...goodBody, sha256Hex: HASH_B }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.reused).toBe(false);
    expect(j.publicId).toBe('smpn3kresek/image/' + HASH_B.slice(0, 16));
    expect(j.resourceType).toBe('image');
    expect(j.signature).toBe('stub-signature-' + j.publicId);
    expect(j.uploadUrl).toBe('https://api.cloudinary.com/v1_1/test-cloud/image/upload');
    expect(j.apiKey).toBe('test-key');
  });

  it('routes pdf kind to the raw resource type', async () => {
    const res = await POST(makeReq({
      kind: 'pdf', mimeType: 'application/pdf', sizeBytes: 200_000,
      sha256Hex: 'c'.repeat(64), filename: 'doc.pdf',
    }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.resourceType).toBe('raw');
    expect(j.publicId).toMatch(/^smpn3kresek\/pdf\//);
  });

  it('429 with Retry-After on the 11th call in 60s', async () => {
    for (let i = 0; i < 10; i++) {
      const res = await POST(makeReq({ ...goodBody, sha256Hex: 'd'.repeat(64) }));
      expect([200, 415, 413, 400]).toContain(res.status); // any 2xx OK
    }
    const blocked = await POST(makeReq({ ...goodBody, sha256Hex: 'd'.repeat(64) }));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toMatch(/^\d+$/);
  });
});
