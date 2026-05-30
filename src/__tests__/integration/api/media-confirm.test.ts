import { prisma } from '@/lib/db/client';
import { uploadRateLimiter } from '@/lib/media/upload-rate-limit';

jest.mock('@/lib/auth/session', () => ({ getSession: jest.fn() }));
import { getSession } from '@/lib/auth/session';
const mockSession = getSession as jest.Mock;

// next/cache is already mocked in jest.integration.setup.ts; reach into it
// to assert revalidateTag was called.
import { revalidateTag } from 'next/cache';
const mockRevalidate = revalidateTag as jest.Mock;

import { POST } from '@/app/api/media/confirm/route';

const HASH = 'e'.repeat(64);
const CLOUD = 'test-cloud';
const PUBLIC_ID = `smpn3kresek/image/${HASH.slice(0, 16)}`;

function goodBody(overrides: Record<string, unknown> = {}, cldOverrides: Record<string, unknown> = {}) {
  return {
    kind: 'image' as const,
    declaredMime: 'image/jpeg',
    sha256Hex: HASH,
    cloudinary: {
      public_id: PUBLIC_ID,
      secure_url: `https://res.cloudinary.com/${CLOUD}/image/upload/v123/${PUBLIC_ID}.jpg`,
      bytes: 200_000,
      format: 'jpg',
      resource_type: 'image' as const,
      original_filename: 'pak-budi',
      signature: 'cloudinary-sig',
      ...cldOverrides,
    },
    ...overrides,
  };
}

function makeReq(body: unknown, ip = '2.2.2.2'): import('next/server').NextRequest {
  const req = new Request('http://localhost/api/media/confirm', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
  return req as unknown as import('next/server').NextRequest;
}

describe('POST /api/media/confirm', () => {
  beforeEach(async () => {
    uploadRateLimiter.resetForTests();
    mockRevalidate.mockClear();
    mockSession.mockResolvedValue({ user: { id: 'admin-2', role: 'ADMIN' } });
    await prisma.mediaAsset.deleteMany({});
  });
  afterAll(async () => {
    await prisma.mediaAsset.deleteMany({});
    await prisma.$disconnect();
  });

  it('rejects a foreign cloud secure_url with 400 forbidden_host', async () => {
    const res = await POST(makeReq(goodBody({}, {
      secure_url: 'https://res.cloudinary.com/attacker/image/upload/v1/x.jpg',
    })));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('forbidden_host');
  });

  it('rejects mismatched format with 415 format_mismatch (kind=pdf but format=jpg)', async () => {
    const res = await POST(makeReq(goodBody({ kind: 'pdf', declaredMime: 'application/pdf' }, {
      // secure_url still points at our cloud but resource_type stays image
      format: 'jpg', resource_type: 'image',
    })));
    expect(res.status).toBe(415);
    expect((await res.json()).error).toBe('format_mismatch');
  });

  it('rejects resource_type=raw when kind=image with 400 resource_type_mismatch', async () => {
    const res = await POST(makeReq(goodBody({}, {
      resource_type: 'raw',
    })));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('resource_type_mismatch');
  });

  it('rejects bytes over limit with 413 too_large', async () => {
    const res = await POST(makeReq(goodBody({}, {
      bytes: 6 * 1024 * 1024,
    })));
    expect(res.status).toBe(413);
    expect((await res.json()).error).toBe('too_large');
  });

  it('happy path: creates MediaAsset, returns it, fires revalidateTag("media")', async () => {
    const res = await POST(makeReq(goodBody()));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.ok).toBe(true);
    expect(j.media.publicId).toBe(PUBLIC_ID);
    expect(j.media.alt).toBeNull();
    expect(await prisma.mediaAsset.count()).toBe(1);
    expect(mockRevalidate).toHaveBeenCalledWith('media');
    // writeAudit is fire-and-forget (errors swallowed) and the AuditLog FK
    // would require a real User row — we don't need to seed one here; the
    // contract is that audit failure must NEVER break the response, which is
    // proved by the 200 above. AuditLog write paths are covered by the
    // teacher-actions integration tests, which seed an admin user.
  });

  it('concurrent identical confirms return the SAME media.id (P2002 idempotency)', async () => {
    const [r1, r2] = await Promise.all([POST(makeReq(goodBody())), POST(makeReq(goodBody()))]);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    const [j1, j2] = await Promise.all([r1.json(), r2.json()]);
    expect(j1.media.id).toBe(j2.media.id);
    expect(await prisma.mediaAsset.count()).toBe(1);
  });

  it('429 with Retry-After on the 11th call in 60s', async () => {
    for (let i = 0; i < 10; i++) {
      await POST(makeReq(goodBody({}, {
        // unique hash per call so we don't hit the dedup path
        public_id: `smpn3kresek/image/uniq-${i}`,
      }), '9.9.9.9'));
    }
    const blocked = await POST(makeReq(goodBody({}, { public_id: 'smpn3kresek/image/blocked' }), '9.9.9.9'));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toMatch(/^\d+$/);
  });
});
