import { buildWhatsAppUrl } from '@lib/utils/buildWhatsAppUrl';

describe('buildWhatsAppUrl', () => {
  it('normalizes a number starting with 0 to international Indonesian format', () => {
    const url = buildWhatsAppUrl({ phone: '081234567890', template: 'hi', fields: {} });
    expect(url.startsWith('https://wa.me/6281234567890?text=')).toBe(true);
  });

  it('strips non-digit characters from the phone number', () => {
    const url = buildWhatsAppUrl({ phone: '+62 (21) 5922-1234', template: 'hi', fields: {} });
    expect(url.startsWith('https://wa.me/62215922')).toBe(true);
  });

  it('interpolates {{field}} placeholders in the template', () => {
    const url = buildWhatsAppUrl({
      phone: '6281234567890',
      template: 'Halo {{nama}}, pesan: {{pesan}}',
      fields: { nama: 'Budi', pesan: 'Apa kabar?' },
    });
    expect(url).toBe(
      'https://wa.me/6281234567890?text=' + encodeURIComponent('Halo Budi, pesan: Apa kabar?'),
    );
  });

  it('encodes characters that would break the URL', () => {
    const url = buildWhatsAppUrl({ phone: '6281234567890', template: 'A & B = C?', fields: {} });
    expect(url).toContain('A%20%26%20B%20%3D%20C%3F');
  });

  it('leaves unreplaced placeholders intact', () => {
    const url = buildWhatsAppUrl({ phone: '6281', template: 'Hi {{nama}}', fields: {} });
    expect(decodeURIComponent(url.split('text=')[1] ?? '')).toBe('Hi {{nama}}');
  });
});
