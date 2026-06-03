// Section TEXT comes from config (src/config/pages/home.ts) — edit code = instant
// change, no DB. The assembler still merges runtime ENTITY data (achievements,
// gallery items from their repos) and overlays the 6 admin-editable section photos
// from the SectionPhoto table on top of the config defaults.
import { homePageConfig } from '@config/pages/home';
import { getAllAchievements } from '../repositories/achievement-repo';
import { getAllGalleryItems } from '../repositories/gallery-repo';
import { getAllSectionPhotos, slotKey } from '../repositories/section-photo-repo';
import type { HomePageConfig } from '@config/types';

// Home shows the most recent N entries of each list (ordered by the admin
// drag-reorder `order` column), so newly added items appear automatically.
const HOME_ACHIEVEMENTS_LIMIT = 5;
const HOME_GALLERY_LIMIT = 8;

export async function assembleHome(): Promise<HomePageConfig> {
  const c = homePageConfig;
  const [allAchievements, allGallery, photos] = await Promise.all([
    getAllAchievements(),
    getAllGalleryItems(),
    getAllSectionPhotos(),
  ]);
  const achievements = allAchievements.slice(0, HOME_ACHIEVEMENTS_LIMIT);
  const gallery = allGallery.slice(0, HOME_GALLERY_LIMIT);

  return {
    ...c,
    // Photo overlay: DB photo when an admin set one, else the config default
    // (unset → gradient placeholder in the render component).
    hero: { ...c.hero, photo: photos[slotKey('home', 'hero', 'photo')] ?? c.hero.photo },
    stats: c.stats,
    sambutan: { ...c.sambutan, photo: photos[slotKey('home', 'sambutan', 'photo')] ?? c.sambutan.photo },
    about: {
      ...c.about,
      photoMain: photos[slotKey('home', 'about', 'photoMain')] ?? c.about.photoMain,
      photoSub: photos[slotKey('home', 'about', 'photoSub')] ?? c.about.photoSub,
    },
    programs: c.programs,
    // Entity lists come from the DB (admin CRUD), not config's seed-source items.
    gallery: { meta: c.gallery.meta, items: gallery, ctaLabel: c.gallery.ctaLabel, ctaHref: c.gallery.ctaHref },
    achievements: {
      meta: c.achievements.meta,
      items: achievements,
      ctaLabel: c.achievements.ctaLabel,
      ctaHref: c.achievements.ctaHref,
    },
    lokasi: c.lokasi,
    ctaFinal: c.ctaFinal,
  };
}
