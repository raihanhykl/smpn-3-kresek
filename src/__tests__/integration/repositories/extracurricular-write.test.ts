import { prisma } from '@/lib/db/client';
import {
  createExtracurricular, updateExtracurricular, deleteExtracurricular, reorderExtracurriculars,
} from '@/lib/data/repositories/extracurricular-repo';

function input(overrides: Partial<Parameters<typeof createExtracurricular>[0]> = {}) {
  return {
    name: 'Pramuka', category: 'wajib' as const, description: 'd',
    pembina: 'Pak A', schedule: 'Sabtu', icon: '⛺', ...overrides,
  };
}

describe('extracurricular write repository', () => {
  beforeEach(async () => { await prisma.extracurricular.deleteMany({}); });
  afterAll(async () => { await prisma.extracurricular.deleteMany({}); await prisma.$disconnect(); });

  it('create + update + delete roundtrip; optional achievement omitted when absent', async () => {
    const e = await createExtracurricular(input());
    expect(e.id).toBeTruthy();
    expect(e.achievement).toBeUndefined();
    const u = await updateExtracurricular(e.id, { ...input(), name: 'Pramuka Inti', achievement: 'Juara LT' });
    expect(u.name).toBe('Pramuka Inti');
    expect(u.achievement).toBe('Juara LT');
    await deleteExtracurricular(e.id);
    expect(await prisma.extracurricular.findUnique({ where: { id: e.id } })).toBeNull();
  });

  it('create sets categoryOrder from EKSKUL_CATEGORY_ORDER', async () => {
    const wajib = await createExtracurricular(input({ category: 'wajib' }));
    const seni = await createExtracurricular(input({ name: 'Tari', category: 'seni' }));
    const wRow = await prisma.extracurricular.findUnique({ where: { id: wajib.id } });
    const sRow = await prisma.extracurricular.findUnique({ where: { id: seni.id } });
    expect(wRow?.categoryOrder).toBe(0); // wajib
    expect(sRow?.categoryOrder).toBe(2); // seni
  });

  it('reorder renumbers order PER-CATEGORY, not globally', async () => {
    // Two in 'olahraga', one in 'seni'. A flat index would give the seni item
    // order=1/2; per-category it must restart at 0 within its own category.
    const o1 = await createExtracurricular(input({ name: 'Futsal', category: 'olahraga' }));
    const o2 = await createExtracurricular(input({ name: 'Basket', category: 'olahraga' }));
    const s1 = await createExtracurricular(input({ name: 'Paduan Suara', category: 'seni' }));
    // Interleave the ids across categories in the requested order.
    await reorderExtracurriculars([o2.id, s1.id, o1.id]);
    const rows = await prisma.extracurricular.findMany({
      where: { id: { in: [o1.id, o2.id, s1.id] } },
      select: { id: true, category: true, order: true },
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    // olahraga: o2 came before o1 → order 0,1
    expect(byId.get(o2.id)?.order).toBe(0);
    expect(byId.get(o1.id)?.order).toBe(1);
    // seni: only s1 → order 0 (NOT 1, which a flat global index would produce)
    expect(byId.get(s1.id)?.order).toBe(0);
  });
});
