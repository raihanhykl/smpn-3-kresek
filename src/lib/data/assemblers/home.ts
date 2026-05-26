// Phase 1: types cast on JSONB sections are unchecked at runtime. Seed is the
// only writer in Phase 1 (Zod-validated). Phase 2 will add Zod-on-write so this
// remains safe; if Phase 2's admin UI ever stores invalid shapes, this assembler
// will surface them via render errors rather than silent data corruption.
import { getPageSections } from '../repositories/page-section-repo';
import { getAchievementsByIds } from '../repositories/achievement-repo';
import { getGalleryItemsByIds } from '../repositories/gallery-repo';
import type {
  HomePageConfig, HeroConfig, SambutanConfig, AboutConfig,
  CtaFinal, SectionMeta, StatCard, ProgramCard, ContactCard, CtaLink,
} from '@config/types';

// Shape stored in DB for sections that wrap "meta + cta + featuredIds".
type GalleryMetaSection = {
  meta: SectionMeta; ctaLabel: string; ctaHref: string; featuredIds: string[];
};
type AchievementsMetaSection = {
  meta: SectionMeta; ctaLabel: string; ctaHref: string; featuredIds: string[];
};
type LokasiSection = {
  meta: SectionMeta; panelTitle: string; panelDescription: string;
  cards: ContactCard[]; primary: CtaLink; secondary: CtaLink; copyText: string;
};
type StatsSection = { meta: SectionMeta; cards: StatCard[] };
type ProgramsSection = { meta: SectionMeta; cards: ProgramCard[] };

export async function assembleHome(): Promise<HomePageConfig> {
  const sections = await getPageSections('home');

  const hero = sections.hero as HeroConfig;
  const stats = sections.stats as StatsSection;
  const sambutan = sections.sambutan as SambutanConfig;
  const about = sections.about as AboutConfig;
  const programs = sections.programs as ProgramsSection;
  const galleryMeta = sections.galleryMeta as GalleryMetaSection;
  const achievementsMeta = sections.achievementsMeta as AchievementsMetaSection;
  const lokasi = sections.lokasi as LokasiSection;
  const ctaFinal = sections.ctaFinal as CtaFinal;

  // Scoped fetch: home only shows the IDs explicitly featured for home.
  // This prevents "all 11 achievements" / "all 18 gallery items" bug.
  const [achievements, gallery] = await Promise.all([
    getAchievementsByIds(achievementsMeta.featuredIds),
    getGalleryItemsByIds(galleryMeta.featuredIds),
  ]);

  return {
    hero,
    stats,
    sambutan,
    about,
    programs,
    gallery: {
      meta: galleryMeta.meta,
      items: gallery,
      ctaLabel: galleryMeta.ctaLabel,
      ctaHref: galleryMeta.ctaHref,
    },
    achievements: {
      meta: achievementsMeta.meta,
      items: achievements,
      ctaLabel: achievementsMeta.ctaLabel,
      ctaHref: achievementsMeta.ctaHref,
    },
    lokasi,
    ctaFinal,
  };
}
