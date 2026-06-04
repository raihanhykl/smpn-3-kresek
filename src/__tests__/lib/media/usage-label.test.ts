import { usageLabel } from '@/lib/media/usage-label';

const row = (usedInTable: string, usedInId: string, usedInField: string) => ({
  usedInTable, usedInId, usedInField,
});

describe('usageLabel', () => {
  it('maps entity tables to Indonesian labels', () => {
    expect(usageLabel(row('Teacher', 'abc', 'photoSrc'))).toBe('Guru');
    expect(usageLabel(row('GalleryItem', 'abc', 'photoSrc'))).toBe('Galeri');
    expect(usageLabel(row('Mading', 'abc', 'image:0'))).toBe('Mading');
    expect(usageLabel(row('DocumentSlot', 'kalender-akademik', 'media'))).toBe('Dokumen');
  });

  it('disambiguates SectionPhoto slots per field so two same-section slots differ', () => {
    expect(usageLabel(row('SectionPhoto', 'home:hero:photo', 'photo'))).toBe('Hero Beranda');
    expect(usageLabel(row('SectionPhoto', 'home:sambutan:photo', 'photo'))).toBe('Foto Kepala Sekolah');
    expect(usageLabel(row('SectionPhoto', 'home:about:photoMain', 'photo'))).toBe('Tentang Kami (foto utama)');
    expect(usageLabel(row('SectionPhoto', 'home:about:photoSub', 'photo'))).toBe('Tentang Kami (foto pendukung)');
    expect(usageLabel(row('SectionPhoto', 'profil:sejarah:photo', 'photo'))).toBe('Sejarah');
    expect(usageLabel(row('SectionPhoto', 'akademik:kurikulum:photo', 'photo'))).toBe('Kurikulum');
  });

  it('two distinct about slots must NOT collapse to the same label', () => {
    const a = usageLabel(row('SectionPhoto', 'home:about:photoMain', 'photo'));
    const b = usageLabel(row('SectionPhoto', 'home:about:photoSub', 'photo'));
    expect(a).not.toBe(b);
  });

  it('falls back to the raw table for unknown tables', () => {
    expect(usageLabel(row('Whatever', 'x', 'y'))).toBe('Whatever');
  });
});
