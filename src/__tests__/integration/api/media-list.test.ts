import { prisma } from '@/lib/db/client';
import { uploadRateLimiter } from '@/lib/media/upload-rate-limit';
import { createMediaAsset } from '@/lib/data/repositories/media-repo';

jest.mock('@/lib/auth/session', () => ({ getSession: jest.fn() }));
import { getSession } from '@/lib/auth/session';
const mockSession = getSession as jest.Mock;

import { GET } from '@/app/api/media/list/route';

function makeReq(qs: string, ip = '3.3.3.3'): import('next/server').NextRequest {
  const req = new Request(`http://localhost/api/media/list${qs ? '?' + qs : ''}`, {
    method: 'GET',
    headers: { 'x-forwarded-for': ip },
  });
  return req as unknown as import('next/server').NextRequest;
}

function makeInput(kind: 'image' | 'pdf', i: number): Parameters<typeof createMediaAsset>[0] {
  const hashHex = i.toString(16).padStart(64, '0');
  return {
    kind, url: `https://res.cloudinary.com/test-cloud/${kind === 'pdf' ? 'raw' : 'image'}/upload/v1/x${i}.${kind === 'pdf' ? 'pdf' : 'jpg'}`,
    publicId: `smpn3kresek/${kind}/x${i}`, hash: hashHex,
    alt: null, filename: `x${i}`, sizeBytes: 1024, mimeType: kind === 'pdf' ? 'application/pdf' : 'image/jpeg',
    width: null, height: null, uploadedBy: 'seed',
  };
}

describe('GET /api/media/list', () => {
  beforeEach(async () => {
    uploadRateLimiter.resetForTests();
    mockSession.mockResolvedValue({ user: { id: 'admin-list', role: 'ADMIN' } });
    await prisma.mediaAsset.deleteMany({});
  });
  afterAll(async () => {
    await prisma.mediaAsset.deleteMany({});
    await prisma.$disconnect();
  });

  it('401 when no session', async () => {
    mockSession.mockResolvedValue(null);
    const res = await GET(makeReq(''));
    expect(res.status).toBe(401);
  });

  it('returns an empty list when there are no assets', async () => {
    const res = await GET(makeReq(''));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.items).toEqual([]);
    expect(j.nextCursor).toBeNull();
  });

  it('filters by kind=image and paginates via cursor', async () => {
    for (let i = 0; i < 5; i++) await createMediaAsset(makeInput('image', i));
    for (let i = 5; i < 8; i++) await createMediaAsset(makeInput('pdf', i));

    const res1 = await GET(makeReq('kind=image&limit=3'));
    const j1 = await res1.json();
    expect(j1.items).toHaveLength(3);
    expect(j1.items.every((m: { kind: string }) => m.kind === 'image')).toBe(true);
    expect(j1.nextCursor).toBeTruthy();

    const res2 = await GET(makeReq(`kind=image&limit=3&cursor=${j1.nextCursor}`));
    const j2 = await res2.json();
    expect(j2.items).toHaveLength(2);
    expect(j2.nextCursor).toBeNull();
  });

  it('400 on bogus limit', async () => {
    const res = await GET(makeReq('limit=999'));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_request');
  });

  it('400 on unknown kind', async () => {
    const res = await GET(makeReq('kind=video'));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_request');
  });
});
