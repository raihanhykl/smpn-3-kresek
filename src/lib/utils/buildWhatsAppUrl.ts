export interface BuildWhatsAppUrlArgs {
  /** International phone number; may include +, dashes, spaces, or leading 0. */
  phone: string;
  /** Message template with {{field}} placeholders. */
  template: string;
  fields: Record<string, string>;
}

/**
 * Build a click-to-chat WhatsApp URL.
 * Normalizes phone (`0xxx` → `62xxx`, strips non-digits) and `encodeURIComponent`s the message.
 */
export function buildWhatsAppUrl({ phone, template, fields }: BuildWhatsAppUrlArgs): string {
  const digits = phone.replace(/\D/g, '');
  const normalized = digits.startsWith('0') ? `62${digits.slice(1)}` : digits;
  const message = Object.entries(fields).reduce(
    (acc, [key, value]) => acc.replaceAll(`{{${key}}}`, value),
    template,
  );
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}
