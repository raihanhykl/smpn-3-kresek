// See header note in assemblers/home.ts about Phase 1 type-cast safety.
import { getPageSections } from '../repositories/page-section-repo';
import { getFaqs } from '../repositories/faq-repo';
import type {
  ContactPageConfig, PageHeaderConfig, ContactFormConfig,
  CtaFinal, SectionMeta, ContactCard, CtaLink,
} from '@config/types';

type KontakInfoSection = {
  meta: SectionMeta; cards: ContactCard[];
  socialHeading: string; socialSub: string;
};
type PetaSection = {
  meta: SectionMeta; placeholderText: string;
  primaryAction: CtaLink; secondaryAction: CtaLink;
};
type FaqMetaSection = {
  meta: SectionMeta; searchPlaceholder: string;
  filterLabels: ContactPageConfig['faq']['filterLabels'];
  noResultsText: string; ctaText: string; ctaHref: string;
};

export async function assembleContact(): Promise<ContactPageConfig> {
  const [sections, faqs] = await Promise.all([
    getPageSections('kontak'),
    getFaqs(),
  ]);

  const pageHeader = sections.pageHeader as PageHeaderConfig;
  const kontakInfo = sections.kontakInfo as KontakInfoSection;
  const peta = sections.peta as PetaSection;
  const form = sections.form as ContactFormConfig;
  const faqMeta = sections.faqMeta as FaqMetaSection;
  const ctaFinal = sections.ctaFinal as CtaFinal;

  return {
    pageHeader,
    kontakInfo,
    peta,
    form,
    faq: {
      meta: faqMeta.meta,
      searchPlaceholder: faqMeta.searchPlaceholder,
      filterLabels: faqMeta.filterLabels,
      items: faqs,
      noResultsText: faqMeta.noResultsText,
      ctaText: faqMeta.ctaText,
      ctaHref: faqMeta.ctaHref,
    },
    ctaFinal,
  };
}
