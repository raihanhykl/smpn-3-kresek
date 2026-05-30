import { teacherSchema } from '@/lib/validation/schemas/entities/teacher';
import { achievementSchema } from '@/lib/validation/schemas/entities/achievement';
import { extracurricularSchema } from '@/lib/validation/schemas/entities/extracurricular';
import { subjectSchema } from '@/lib/validation/schemas/entities/subject';
import { faqSchema } from '@/lib/validation/schemas/entities/faq';
import { galleryItemSchema } from '@/lib/validation/schemas/entities/gallery-item';
import { facilitySchema } from '@/lib/validation/schemas/entities/facility';
import { organizationMemberSchema } from '@/lib/validation/schemas/entities/organization-member';

describe('entity Zod schemas', () => {
  it('teacherSchema accepts gradient photo', () => {
    expect(teacherSchema.safeParse({
      id: 'g1', name: 'Bu Siti', position: 'Guru Matematika', badge: 'S.Pd.',
      category: 'guru', photo: { kind: 'gradient', from: '#DBEAFE', to: '#93C5FD', emoji: '👩‍🏫' },
    }).success).toBe(true);
  });

  it('teacherSchema rejects unknown category', () => {
    expect(teacherSchema.safeParse({
      id: 'g1', name: 'X', position: 'Y', badge: 'Z',
      category: 'kepala', photo: { kind: 'gradient', from: '#000', to: '#fff', emoji: '👤' },
    }).success).toBe(false);
  });

  it('achievementSchema accepts valid input', () => {
    expect(achievementSchema.safeParse({
      id: 'a1', year: 2024, title: 'Juara 1', recipient: 'Tim',
      organizer: 'Kemendikbud', level: 'nasional', icon: '🏆',
    }).success).toBe(true);
  });

  it('extracurricularSchema accepts optional achievement', () => {
    const base = {
      id: 'e1', name: 'Pramuka', category: 'wajib', description: 'd',
      pembina: 'Pak X', schedule: 'Sabtu', icon: '⛺',
    };
    expect(extracurricularSchema.safeParse(base).success).toBe(true);
    expect(extracurricularSchema.safeParse({ ...base, achievement: 'Juara 1' }).success).toBe(true);
  });

  it('subjectSchema accepts a subject taught in multiple grades', () => {
    expect(subjectSchema.safeParse({
      id: 's1', group: 'wajib', name: 'Matematika', icon: '📐', iconBg: '#DBEAFE',
      hoursByGrade: { '7': '5 JP', '8': '5 JP', '9': '6 JP' },
    }).success).toBe(true);
  });

  it('subjectSchema rejects hoursByGrade with no grades', () => {
    expect(subjectSchema.safeParse({
      id: 's1', group: 'wajib', name: 'x', icon: 'x', iconBg: 'x', hoursByGrade: {},
    }).success).toBe(false);
  });

  it('subjectSchema rejects an unknown grade key', () => {
    expect(subjectSchema.safeParse({
      id: 's1', group: 'wajib', name: 'x', icon: 'x', iconBg: 'x',
      hoursByGrade: { '6': '5 JP' },
    }).success).toBe(false);
  });

  it('faqSchema accepts valid input', () => {
    expect(faqSchema.safeParse({
      id: 'f1', question: 'Q', answer: 'A', category: 'akademik',
    }).success).toBe(true);
  });

  it('galleryItemSchema accepts optional span', () => {
    const base = {
      id: 'g1', caption: 'c',
      photo: { kind: 'gradient', from: '#000', to: '#fff', emoji: '🎓' },
    };
    expect(galleryItemSchema.safeParse(base).success).toBe(true);
    expect(galleryItemSchema.safeParse({ ...base, span: 'wide' }).success).toBe(true);
    expect(galleryItemSchema.safeParse({ ...base, span: 'invalid' }).success).toBe(false);
  });

  it('facilitySchema discriminates featured vs mini', () => {
    expect(facilitySchema.safeParse({
      kind: 'featured', id: 'f1', name: 'Lab', description: 'd',
      photo: { kind: 'gradient', from: '#000', to: '#fff', emoji: '🔬' },
    }).success).toBe(true);
    expect(facilitySchema.safeParse({
      kind: 'mini', id: 'f2', name: 'Kantin', icon: '🍽️',
    }).success).toBe(true);
  });

  it('organizationMemberSchema accepts valid input', () => {
    expect(organizationMemberSchema.safeParse({
      id: 'o1', name: 'Pak X', role: 'Kepala Sekolah', level: 0, parentId: null,
    }).success).toBe(true);
  });
});
