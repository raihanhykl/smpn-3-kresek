import { GET } from '@/app/api/health/route';

describe('GET /api/health', () => {
  it('returns 200 + status ok when DB is reachable', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('ok');
  });
});
