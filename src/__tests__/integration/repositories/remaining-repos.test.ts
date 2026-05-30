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
        // Matematika taught in 7+8, IPA only in 7 — deduped into single rows.
        { id: 's1', group: 'wajib', name: 'Matematika', icon: '📐', iconBg: '#fff',
          hoursByGrade: { '7': '5 JP', '8': '5 JP' }, order: 0 },
        { id: 's2', group: 'wajib', name: 'IPA', icon: '🔬', iconBg: '#fff',
          hoursByGrade: { '7': '5 JP' }, order: 1 },
      ],
    });
    await prisma.faq.create({
      data: { id: 'q1', question: 'Q', answer: 'A', category: 'akademik', order: 0 },
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

  it('getSubjectGroupsByGrade surfaces deduped rows for the requested grade', async () => {
    const g7 = await getSubjectGroupsByGrade(7);
    expect(g7).toHaveLength(1);
    expect(g7[0]?.id).toBe('wajib');
    expect(g7[0]?.subjects.map((s) => s.name).sort()).toEqual(['IPA', 'Matematika']);
    // Grade 8: only Matematika (IPA not taught there) — same row, no duplication.
    const g8 = await getSubjectGroupsByGrade(8);
    expect(g8[0]?.subjects.map((s) => s.name)).toEqual(['Matematika']);
  });

  it('getFaqs returns array', async () => {
    const faqs = await getFaqs();
    expect(faqs).toHaveLength(1);
    expect(faqs[0]?.category).toBe('akademik');
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
