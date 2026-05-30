-- Phase 3b: GalleryItem migrates from flat emoji/gradientFrom/gradientTo to
-- the shared 6-column Photo discriminated union. All existing rows backfill
-- to the gradient branch — no data loss.

-- 1. add new columns with safe defaults
ALTER TABLE "GalleryItem"
  ADD COLUMN "photoKind"  TEXT NOT NULL DEFAULT 'gradient',
  ADD COLUMN "photoSrc"   TEXT,
  ADD COLUMN "photoAlt"   TEXT,
  ADD COLUMN "photoFrom"  TEXT,
  ADD COLUMN "photoTo"    TEXT,
  ADD COLUMN "photoEmoji" TEXT;

-- 2. backfill from legacy columns (every existing row becomes a valid gradient Photo)
UPDATE "GalleryItem"
  SET "photoFrom"  = "gradientFrom",
      "photoTo"    = "gradientTo",
      "photoEmoji" = "emoji",
      "photoKind"  = 'gradient';

-- 3. drop legacy columns
ALTER TABLE "GalleryItem"
  DROP COLUMN "gradientFrom",
  DROP COLUMN "gradientTo",
  DROP COLUMN "emoji";
