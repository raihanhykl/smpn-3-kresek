import { prisma } from '@/lib/db/client';
import { getTeachers } from '@/lib/data/repositories/teacher-repo';
import { getAllAchievements, getAchievementsByIds } from '@/lib/data/repositories/achievement-repo';
import { getExtracurriculars } from '@/lib/data/repositories/extracurricular-repo';

describe('entity repositories', () => {
  beforeAll(async () => {
    await prisma.teacher.deleteMany({});
    await prisma.achievement.deleteMany({});
    await prisma.extracurricular.deleteMany({});

    await prisma.teacher.createMany({
      data: [
        { id: 't1', name: 'A', position: 'Guru', badge: 'S.Pd.', category: 'guru',
          categoryOrder: 1,
          photoKind: 'gradient', photoFrom: '#000', photoTo: '#fff', photoEmoji: '👤', order: 0 },
        { id: 't2', name: 'B', position: 'Kepsek', badge: 'M.Pd.', category: 'pimpinan',
          categoryOrder: 0,
          photoKind: 'gradient', photoFrom: '#000', photoTo: '#fff', photoEmoji: '👤', order: 0 },
      ],
    });
    await prisma.achievement.createMany({
      data: [
        { id: 'a1', year: 2023, title: 'X', recipient: 'Y', organizer: 'Z',
          level: 'nasional', icon: '🏆', order: 1 },
        { id: 'a2', year: 2024, title: 'A', recipient: 'B', organizer: 'C',
          level: 'kabupaten', icon: '🥇', order: 0 },
      ],
    });
    await prisma.extracurricular.create({
      data: { id: 'e1', name: 'Pramuka', category: 'wajib', categoryOrder: 0,
        description: 'd', pembina: 'X', schedule: 'Sabtu', icon: '⛺', order: 0 },
    });
  });

  afterAll(async () => {
    await prisma.teacher.deleteMany({});
    await prisma.achievement.deleteMany({});
    await prisma.extracurricular.deleteMany({});
    await prisma.$disconnect();
  });

  it('getTeachers returns Teacher[] with photo discriminator + ordered by [categoryOrder, order]', async () => {
    const teachers = await getTeachers();
    expect(teachers).toHaveLength(2);
    // Pimpinan has categoryOrder=0 (seeded ahead), Guru has categoryOrder=1.
    // Even though "guru" < "pimpinan" alphabetically, categoryOrder wins.
    expect(teachers[0]?.category).toBe('pimpinan');
    expect(teachers[0]?.photo).toEqual({ kind: 'gradient', from: '#000', to: '#fff', emoji: '👤' });
  });

  it('getAllAchievements returns ordered Achievement[]', async () => {
    const items = await getAllAchievements();
    expect(items).toHaveLength(2);
    expect(items[0]?.id).toBe('a2'); // order 0 first
  });

  it('getAchievementsByIds preserves caller order and drops unknown IDs', async () => {
    const items = await getAchievementsByIds(['a1', 'nonexistent', 'a2']);
    expect(items.map((i) => i.id)).toEqual(['a1', 'a2']);
  });

  it('getExtracurriculars returns shape matching types.ts', async () => {
    const items = await getExtracurriculars();
    expect(items[0]).toMatchObject({
      id: 'e1', name: 'Pramuka', category: 'wajib',
      pembina: 'X', schedule: 'Sabtu', icon: '⛺',
    });
    // No 'achievement' field in row → should be undefined (not null) per types.ts
    expect(items[0]?.achievement).toBeUndefined();
  });
});
