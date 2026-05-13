export interface BuildMailtoUrlArgs {
  to: string;
  subject: string;
  body: string;
  subjectTemplate?: string;
  bodyTemplate?: string;
  fields?: Record<string, string>;
}

function interpolate(template: string, fields: Record<string, string>): string {
  return Object.entries(fields).reduce(
    (acc, [key, value]) => acc.replaceAll(`{{${key}}}`, value),
    template,
  );
}

/**
 * Build a `mailto:` URL with encoded subject and body.
 * If `subjectTemplate`/`bodyTemplate` + `fields` are provided, they are
 * interpolated before encoding.
 */
export function buildMailtoUrl(args: BuildMailtoUrlArgs): string {
  const { to, fields = {} } = args;
  const subject = args.subjectTemplate ? interpolate(args.subjectTemplate, fields) : args.subject;
  const body = args.bodyTemplate ? interpolate(args.bodyTemplate, fields) : args.body;
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
