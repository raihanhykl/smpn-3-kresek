import { buildMailtoUrl } from '@lib/utils/buildMailtoUrl';

describe('buildMailtoUrl', () => {
  it('builds a basic mailto URL with encoded subject and body', () => {
    const url = buildMailtoUrl({ to: 'info@example.com', subject: 'Hi & welcome', body: 'a=b' });
    expect(url).toBe(
      `mailto:info@example.com?subject=${encodeURIComponent('Hi & welcome')}&body=${encodeURIComponent('a=b')}`,
    );
  });

  it('interpolates subject and body templates using fields', () => {
    const url = buildMailtoUrl({
      to: 'a@b.id',
      subject: '',
      body: '',
      subjectTemplate: '[{{subjek}}] dari {{nama}}',
      bodyTemplate: 'Nama: {{nama}}\nEmail: {{email}}',
      fields: { subjek: 'Informasi Akademik', nama: 'Budi', email: 'budi@test.com' },
    });
    expect(url).toContain('subject=' + encodeURIComponent('[Informasi Akademik] dari Budi'));
    expect(url).toContain('body=' + encodeURIComponent('Nama: Budi\nEmail: budi@test.com'));
  });

  it('uses literal subject/body when no template is provided', () => {
    const url = buildMailtoUrl({ to: 'x@y.com', subject: 'literal', body: 'body' });
    expect(url).toContain('subject=literal');
    expect(url).toContain('body=body');
  });
});
