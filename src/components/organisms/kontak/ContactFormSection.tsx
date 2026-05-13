'use client';

import { useState } from 'react';
import { Container } from '@components/atoms/Container';
import { SectionLabel } from '@components/atoms/SectionLabel';
import { Button } from '@components/atoms/Button';
import { buildWhatsAppUrl } from '@lib/utils/buildWhatsAppUrl';
import { buildMailtoUrl } from '@lib/utils/buildMailtoUrl';
import { validateContactForm, type ContactFormValues } from '@lib/utils/validateContactForm';
import { cn } from '@lib/utils/cn';
import type { ContactPageConfig } from '@config/types';

const initialValues: ContactFormValues = {
  nama: '',
  email: '',
  telp: '',
  subjek: '',
  pesan: '',
  agree: false,
};

export function ContactFormSection({ data }: { data: ContactPageConfig['form'] }) {
  const [values, setValues] = useState<ContactFormValues>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof ContactFormValues, string>>>({});

  const update = <K extends keyof ContactFormValues>(key: K, value: ContactFormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
  };

  const validate = () => {
    const result = validateContactForm(values, {
      nama: data.fields.nama.errorMessage,
      email: data.fields.email.errorMessage,
      telp: data.fields.telp.errorMessage,
      subjek: data.fields.subjek.errorMessage,
      pesan: data.fields.pesan.errorMessage,
      agree: data.agreement.errorMessage,
    });
    setErrors(result.errors);
    return result.ok;
  };

  const handleWhatsApp = () => {
    if (!validate()) return;
    const url = buildWhatsAppUrl({
      phone: data.waNumber,
      template: data.waMessageTemplate,
      fields: values as unknown as Record<string, string>,
    });
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleEmail = () => {
    if (!validate()) return;
    const url = buildMailtoUrl({
      to: data.emailTo,
      subject: '',
      body: '',
      subjectTemplate: data.emailSubjectTemplate,
      bodyTemplate: data.emailBodyTemplate,
      fields: values as unknown as Record<string, string>,
    });
    window.location.href = url;
  };

  const inputClass = (hasError: boolean) =>
    cn(
      'w-full rounded-sm border bg-white px-4 py-3 text-sm transition-colors focus:outline-none focus:ring-2',
      hasError
        ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
        : 'border-neutral-300 focus:border-primary focus:ring-primary/20',
    );

  return (
    <section id="form" className="bg-white py-24">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[2fr_3fr]">
          <div>
            <SectionLabel className="mb-3">{data.eyebrow}</SectionLabel>
            <h2 className="font-heading text-[clamp(24px,3vw,36px)] font-extrabold text-neutral-900">{data.title}</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-neutral-600">{data.intro}</p>
            <div className="mt-6 rounded-md bg-primary-bg p-4">
              <div className="flex items-start gap-3 text-sm text-neutral-700">
                <span aria-hidden className="text-xl">{data.noteIcon}</span>
                <span>{data.noteText}</span>
              </div>
            </div>
          </div>
          <form
            onSubmit={(e) => e.preventDefault()}
            className="rounded-md border border-neutral-200 bg-white p-6 shadow-sm md:p-8"
          >
            <div className="grid gap-5">
              <div>
                <label htmlFor="nama" className="mb-1.5 block text-sm font-semibold text-neutral-700">
                  {data.fields.nama.label}
                </label>
                <input
                  id="nama"
                  type="text"
                  value={values.nama}
                  onChange={(e) => update('nama', e.target.value)}
                  placeholder={data.fields.nama.placeholder}
                  className={inputClass(Boolean(errors.nama))}
                />
                {errors.nama ? <p className="mt-1 text-xs text-red-500">{errors.nama}</p> : null}
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-neutral-700">
                    {data.fields.email.label}
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={values.email}
                    onChange={(e) => update('email', e.target.value)}
                    placeholder={data.fields.email.placeholder}
                    className={inputClass(Boolean(errors.email))}
                  />
                  {errors.email ? <p className="mt-1 text-xs text-red-500">{errors.email}</p> : null}
                </div>
                <div>
                  <label htmlFor="telp" className="mb-1.5 block text-sm font-semibold text-neutral-700">
                    {data.fields.telp.label}
                  </label>
                  <input
                    id="telp"
                    type="tel"
                    value={values.telp}
                    onChange={(e) => update('telp', e.target.value)}
                    placeholder={data.fields.telp.placeholder}
                    className={inputClass(Boolean(errors.telp))}
                  />
                  {errors.telp ? <p className="mt-1 text-xs text-red-500">{errors.telp}</p> : null}
                </div>
              </div>
              <div>
                <label htmlFor="subjek" className="mb-1.5 block text-sm font-semibold text-neutral-700">
                  {data.fields.subjek.label}
                </label>
                <select
                  id="subjek"
                  value={values.subjek}
                  onChange={(e) => update('subjek', e.target.value)}
                  className={inputClass(Boolean(errors.subjek))}
                >
                  <option value="">{data.fields.subjek.placeholder}</option>
                  {data.fields.subjek.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                {errors.subjek ? <p className="mt-1 text-xs text-red-500">{errors.subjek}</p> : null}
              </div>
              <div>
                <label htmlFor="pesan" className="mb-1.5 block text-sm font-semibold text-neutral-700">
                  {data.fields.pesan.label}
                </label>
                <textarea
                  id="pesan"
                  rows={5}
                  value={values.pesan}
                  onChange={(e) => update('pesan', e.target.value)}
                  placeholder={data.fields.pesan.placeholder}
                  className={inputClass(Boolean(errors.pesan))}
                />
                {errors.pesan ? <p className="mt-1 text-xs text-red-500">{errors.pesan}</p> : null}
              </div>
              <label className="flex items-start gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={values.agree}
                  onChange={(e) => update('agree', e.target.checked)}
                  className="mt-1"
                />
                <span>{data.agreement.label}</span>
              </label>
              {errors.agree ? <p className="-mt-3 text-xs text-red-500">{errors.agree}</p> : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <Button onClick={handleWhatsApp} variant="wa" className="w-full">
                  {data.waButtonLabel}
                </Button>
                <Button onClick={handleEmail} variant="email" className="w-full">
                  {data.emailButtonLabel}
                </Button>
              </div>
              <p className="text-xs text-neutral-500">{data.helperText}</p>
            </div>
          </form>
        </div>
      </Container>
    </section>
  );
}
