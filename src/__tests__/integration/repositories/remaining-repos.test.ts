import { prisma } from '@/lib/db/client';
import { getSubjectGroupsByGrade } from '@/lib/data/repositories/subject-repo';
import { getFaqs } from '@/lib/data/repositories/faq-repo';
import { getAllGalleryItems } from '@/lib/data/repositories/gallery-repo';
import { getFacilitiesGrouped } from '@/lib/data/repositories/facility-repo';
import { getOrganizationChart } from '@/lib/data/repositories/organization-repo';
import { getDocumentSlot } from '@/lib/data/repositories/document-slot-repo';

describe('remaining entity repositories', () => {
  beforeAll(async () => {
    await prisma.subject.deleteMany({});
    await prisma.faq.deleteMany({});
    await prisma.galleryItem.deleteMany({});
    await prisma.facility.deleteMany({});
    await prisma.organizationMember.deleteMany({});
    await prisma.documentSlot.deleteMany({});

    await prisma.subject.createMany({
      data: [
        { id: 's1', grade: 7, groupId: 'a', groupTitle: 'Kelompok A',
          name: 'Matematika', icon: '📐', iconBg: '#fff', hours: '5', order: 0 },
        { id: 's2', grade: 7, groupId: 'a', groupTitle: 'Kelompok A',
          name: 'IPA', icon: '🔬', iconBg: '#fff', hours: '5', order: 1 },
        { id: 's3', grade: 8, groupId: 'a', groupTitle: 'Kelompok A',
          name: 'Matematika', icon: '📐', iconBg: '#fff', hours: '5', order: 0 },
      ],
    });
    await prisma.faq.create({
      data: { id: 'q1', question: 'Q', answer: 'A', category: 'ppdb', order: 0 },
    });
    await prisma.galleryItem.create({
      data: { id: 'g1', caption: 'C', emoji: '📚', gradientFrom: '#000', gradientTo: '#fff', order: 0 },
    });
    await prisma.facility.createMany({
      data: [
        { id: 'f1', kind: 'featured', name: 'Lab', description: 'd', emoji: '🔬',
          gradientFrom: '#000', gradientTo: '#fff', order: 0 },
        { id: 'f2', kind: 'mini', name: 'Kantin', icon: '🍽️', order: 0 },
      ],
    });
    await prisma.organizationMember.createMany({
      data: [
        { id: 'om1', name: 'Pak X', role: 'Kepsek', level: 0, order: 0 },
        { id: 'om2', name: 'Bu Y', role: 'Wakasek', level: 1, parentId: 'om1', order: 0 },
      ],
    });
    await prisma.documentSlot.create({ data: { id: 'kalender-akademik' } });
  });

  afterAll(async () => {
    await prisma.subject.deleteMany({});
    await prisma.faq.deleteMany({});
    await prisma.galleryItem.deleteMany({});
    await prisma.facility.deleteMany({});
    await prisma.organizationMember.deleteMany({});
    await prisma.documentSlot.deleteMany({});
    await prisma.$disconnect();
  });

  it('getSubjectGroupsByGrade returns subjects grouped by grade → groupId', async () => {
    const groups = await getSubjectGroupsByGrade(7);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.id).toBe('a');
    expect(groups[0]?.subjects).toHaveLength(2);
    expect(groups[0]?.subjects[0]?.name).toBe('Matematika');
  });

  it('getFaqs returns array', async () => {
    const faqs = await getFaqs();
    expect(faqs).toHaveLength(1);
    expect(faqs[0]?.category).toBe('ppdb');
  });

  it('getAllGalleryItems returns array', async () => {
    const items = await getAllGalleryItems();
    expect(items).toHaveLength(1);
  });

  it('getFacilitiesGrouped returns { featured: [...], mini: [...] }', async () => {
    const grouped = await getFacilitiesGrouped();
    expect(grouped.featured).toHaveLength(1);
    expect(grouped.mini).toHaveLength(1);
    expect(grouped.featured[0]?.emoji).toBe('🔬');
  });

  it('getOrganizationChart returns levels grouped by level number', async () => {
    const chart = await getOrganizationChart();
    expect(chart).toHaveLength(2);
    expect(chart[0]?.boxes[0]?.name).toBe('Pak X');
    expect(chart[1]?.boxes[0]?.name).toBe('Bu Y');
  });

  it('getDocumentSlot returns full shape with mediaId=null when no upload', async () => {
    const slot = await getDocumentSlot('kalender-akademik');
    expect(slot).toEqual({ id: 'kalender-akademik', mediaId: null });
  });

  it('getDocumentSlot returns null for unknown slot id', async () => {
    const slot = await getDocumentSlot('nonexistent');
    expect(slot).toBeNull();
  });
});
