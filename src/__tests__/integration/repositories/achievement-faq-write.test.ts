import { prisma } from '@/lib/db/client';
import { createAchievement, updateAchievement, deleteAchievement, reorderAchievements } from '@/lib/data/repositories/achievement-repo';
import { createFaq, updateFaq, deleteFaq } from '@/lib/data/repositories/faq-repo';

describe('achievement + faq write repositories', () => {
  beforeEach(async () => {
    await prisma.achievement.deleteMany({});
    await prisma.faq.deleteMany({});
  });
  afterAll(async () => {
    await prisma.achievement.deleteMany({});
    await prisma.faq.deleteMany({});
    await prisma.$disconnect();
  });

  const gradient = (emoji = '🏆') => ({
    kind: 'gradient' as const, from: '#E0F2FE', to: '#FFFFFF', emoji,
  });

  it('createAchievement + update + delete roundtrip', async () => {
    const a = await createAchievement({
      year: 2024, title: 'Juara 1', recipient: 'Tim', organizer: 'Kemendikbud', level: 'nasional', photo: gradient(),
    });
    expect(a.id).toBeTruthy();
    const u = await updateAchievement(a.id, { ...a, title: 'Juara 2' });
    expect(u.title).toBe('Juara 2');
    await deleteAchievement(a.id);
    expect(await prisma.achievement.findUnique({ where: { id: a.id } })).toBeNull();
  });

  it('reorderAchievements sets order by index', async () => {
    const a = await createAchievement({ year: 2024, title: 'A', recipient: 'r', organizer: 'o', level: 'nasional', photo: gradient() });
    const b = await createAchievement({ year: 2024, title: 'B', recipient: 'r', organizer: 'o', level: 'nasional', photo: gradient() });
    await reorderAchievements([b.id, a.id]);
    const rows = await prisma.achievement.findMany({ orderBy: { order: 'asc' } });
    expect(rows.map((r) => r.id)).toEqual([b.id, a.id]);
  });

  it('createFaq + update + delete roundtrip', async () => {
    const f = await createFaq({ question: 'Q?', answer: 'A.', category: 'akademik' });
    expect(f.id).toBeTruthy();
    const u = await updateFaq(f.id, { ...f, answer: 'Updated.' });
    expect(u.answer).toBe('Updated.');
    await deleteFaq(f.id);
    expect(await prisma.faq.findUnique({ where: { id: f.id } })).toBeNull();
  });
});
