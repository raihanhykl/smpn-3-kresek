// Section TEXT from config (src/config/pages/kontak.ts). FAQ items still merged
// from the DB (admin CRUD). No admin-editable section photos on this page.
import { kontakPageConfig } from '@config/pages/kontak';
import { getFaqs } from '../repositories/faq-repo';
import type { ContactPageConfig } from '@config/types';

export async function assembleContact(): Promise<ContactPageConfig> {
  const c = kontakPageConfig;
  const faqs = await getFaqs();

  return {
    ...c,
    pageHeader: c.pageHeader,
    kontakInfo: c.kontakInfo,
    peta: c.peta,
    form: c.form,
    faq: {
      meta: c.faq.meta,
      searchPlaceholder: c.faq.searchPlaceholder,
      filterLabels: c.faq.filterLabels,
      items: faqs,
      noResultsText: c.faq.noResultsText,
      ctaText: c.faq.ctaText,
      ctaHref: c.faq.ctaHref,
    },
    ctaFinal: c.ctaFinal,
  };
}
