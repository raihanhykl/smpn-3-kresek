-- Phase 3b: Extracurricular migrates from flat icon (emoji) to the shared
-- Photo discriminated union. Existing rows backfill to gradient using a
-- neutral default colour pair + the legacy icon as the emoji.

-- 1. add photo columns
ALTER TABLE "Extracurricular"
  ADD COLUMN "photoKind"  TEXT NOT NULL DEFAULT 'gradient',
  ADD COLUMN "photoSrc"   TEXT,
  ADD COLUMN "photoAlt"   TEXT,
  ADD COLUMN "photoFrom"  TEXT,
  ADD COLUMN "photoTo"    TEXT,
  ADD COLUMN "photoEmoji" TEXT;

-- 2. backfill: every existing row becomes a valid gradient Photo. Default
--    colours match the placeholder used today by EkskulCard (neutral grey).
UPDATE "Extracurricular"
  SET "photoFrom"  = '#F1F5F9',
      "photoTo"    = '#CBD5E1',
      "photoEmoji" = "icon",
      "photoKind"  = 'gradient';

-- 3. drop legacy icon column
ALTER TABLE "Extracurricular" DROP COLUMN "icon";
