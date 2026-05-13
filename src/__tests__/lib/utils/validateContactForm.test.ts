import { validateContactForm, type ContactFormValues, type ValidationMessages } from '@lib/utils/validateContactForm';

const messages: ValidationMessages = {
  nama: 'Nama wajib',
  email: 'Email tidak valid',
  telp: 'Telepon wajib',
  subjek: 'Subjek wajib',
  pesan: 'Pesan wajib',
  agree: 'Persetujuan wajib',
};

const validValues: ContactFormValues = {
  nama: 'Budi',
  email: 'budi@example.com',
  telp: '081234567890',
  subjek: 'PPDB',
  pesan: 'Halo',
  agree: true,
};

describe('validateContactForm', () => {
  it('returns ok=true when all fields are valid', () => {
    const result = validateContactForm(validValues, messages);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('flags missing nama', () => {
    const result = validateContactForm({ ...validValues, nama: ' ' }, messages);
    expect(result.ok).toBe(false);
    expect(result.errors.nama).toBe(messages.nama);
  });

  it('flags malformed email', () => {
    const result = validateContactForm({ ...validValues, email: 'not-an-email' }, messages);
    expect(result.ok).toBe(false);
    expect(result.errors.email).toBe(messages.email);
  });

  it('flags too-short phone numbers', () => {
    const result = validateContactForm({ ...validValues, telp: '12' }, messages);
    expect(result.ok).toBe(false);
    expect(result.errors.telp).toBe(messages.telp);
  });

  it('flags unchecked agreement', () => {
    const result = validateContactForm({ ...validValues, agree: false }, messages);
    expect(result.ok).toBe(false);
    expect(result.errors.agree).toBe(messages.agree);
  });

  it('collects multiple errors at once', () => {
    const result = validateContactForm(
      { nama: '', email: 'bad', telp: '', subjek: '', pesan: '', agree: false },
      messages,
    );
    expect(result.ok).toBe(false);
    expect(Object.keys(result.errors).sort()).toEqual(['agree', 'email', 'nama', 'pesan', 'subjek', 'telp']);
  });
});
