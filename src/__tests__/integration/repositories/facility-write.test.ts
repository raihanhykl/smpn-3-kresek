import { prisma } from '@/lib/db/client';
import type { Photo } from '@config/types';
import {
  createFacility, updateFacility, deleteFacility, reorderFacilities, getAllFacilities,
} from '@/lib/data/repositories/facility-repo';

const gradient = (emoji = '🔬'): Photo => ({
  kind: 'gradient', from: '#DBEAFE', to: '#93C5FD', emoji,
});

describe('facility write repository', () => {
  beforeEach(async () => { await prisma.facility.deleteMany({}); });
  afterAll(async () => { await prisma.facility.deleteMany({}); await prisma.$disconnect(); });

  it('create featured + mini roundtrip; nullable columns set per kind', async () => {
    const feat = await createFacility({
      kind: 'featured', name: 'Lab IPA', description: 'Lab sains',
      photo: gradient('🔬'),
      span: 'wide',
    });
    expect(feat.kind).toBe('featured');
    const mini = await createFacility({ kind: 'mini', name: 'Toilet', icon: '🚻' });
    expect(mini.kind).toBe('mini');

    const featRow = await prisma.facility.findUnique({ where: { id: feat.id } });
    expect(featRow?.icon).toBeNull();
    expect(featRow?.description).toBe('Lab sains');
    expect(featRow?.photoKind).toBe('gradient');
    const miniRow = await prisma.facility.findUnique({ where: { id: mini.id } });
    expect(miniRow?.description).toBeNull();
    expect(miniRow?.icon).toBe('🚻');
    expect(miniRow?.photoKind).toBeNull();

    const u = await updateFacility(feat.id, {
      kind: 'featured', name: 'Lab IPA Baru', description: 'd',
      photo: { kind: 'gradient', from: '#D1FAE5', to: '#6EE7B7', emoji: '🧪' },
    });
    expect(u.kind === 'featured' && u.name).toBe('Lab IPA Baru');

    await deleteFacility(mini.id);
    expect(await prisma.facility.findUnique({ where: { id: mini.id } })).toBeNull();
  });

  it('switching kind on update clears the other kind\'s columns', async () => {
    const f = await createFacility({
      kind: 'featured', name: 'X', description: 'd',
      photo: gradient('🏫'),
    });
    await updateFacility(f.id, { kind: 'mini', name: 'X', icon: '📌' });
    const row = await prisma.facility.findUnique({ where: { id: f.id } });
    expect(row?.kind).toBe('mini');
    expect(row?.description).toBeNull();
    expect(row?.photoKind).toBeNull();
    expect(row?.photoEmoji).toBeNull();
    expect(row?.photoFrom).toBeNull();
    expect(row?.icon).toBe('📌');
  });

  it('reorder renumbers PER-KIND, not globally', async () => {
    const f1 = await createFacility({ kind: 'featured', name: 'F1', description: 'd', photo: gradient() });
    const f2 = await createFacility({ kind: 'featured', name: 'F2', description: 'd', photo: gradient() });
    const m1 = await createFacility({ kind: 'mini', name: 'M1', icon: '📌' });
    await reorderFacilities([f2.id, m1.id, f1.id]);
    const rows = await prisma.facility.findMany({ where: { id: { in: [f1.id, f2.id, m1.id] } } });
    const byId = new Map(rows.map((r) => [r.id, r]));
    expect(byId.get(f2.id)?.order).toBe(0);
    expect(byId.get(f1.id)?.order).toBe(1);
    expect(byId.get(m1.id)?.order).toBe(0); // mini restarts at 0
  });

  it('getAllFacilities returns the discriminated union flat list', async () => {
    await createFacility({ kind: 'mini', name: 'M', icon: '📌' });
    await createFacility({ kind: 'featured', name: 'F', description: 'd', photo: gradient() });
    const all = await getAllFacilities();
    expect(all).toHaveLength(2);
    expect(all.some((f) => f.kind === 'featured')).toBe(true);
    expect(all.some((f) => f.kind === 'mini')).toBe(true);
  });
});
