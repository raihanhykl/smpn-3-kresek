export interface ContactFormValues {
  nama: string;
  email: string;
  telp: string;
  subjek: string;
  pesan: string;
  agree: boolean;
}

export type ContactFormField = keyof ContactFormValues;

export interface ContactFormValidationResult {
  ok: boolean;
  errors: Partial<Record<ContactFormField, string>>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+\-\s()]{6,}$/;

export interface ValidationMessages {
  nama: string;
  email: string;
  telp: string;
  subjek: string;
  pesan: string;
  agree: string;
}

export function validateContactForm(
  values: ContactFormValues,
  messages: ValidationMessages,
): ContactFormValidationResult {
  const errors: ContactFormValidationResult['errors'] = {};
  if (!values.nama.trim()) errors.nama = messages.nama;
  if (!values.email.trim() || !EMAIL_RE.test(values.email)) errors.email = messages.email;
  if (!values.telp.trim() || !PHONE_RE.test(values.telp)) errors.telp = messages.telp;
  if (!values.subjek.trim()) errors.subjek = messages.subjek;
  if (!values.pesan.trim()) errors.pesan = messages.pesan;
  if (!values.agree) errors.agree = messages.agree;
  return { ok: Object.keys(errors).length === 0, errors };
}
