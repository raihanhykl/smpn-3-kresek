-- Phase 3b: Achievement migrates from flat icon (emoji) to the shared Photo
-- discriminated union. Existing rows backfill to the gradient branch with a
-- primary-bg default colour pair + the legacy icon hoisted to photoEmoji.

ALTER TABLE "Achievement"
  ADD COLUMN "photoKind"  TEXT NOT NULL DEFAULT 'gradient',
  ADD COLUMN "photoSrc"   TEXT,
  ADD COLUMN "photoAlt"   TEXT,
  ADD COLUMN "photoFrom"  TEXT,
  ADD COLUMN "photoTo"    TEXT,
  ADD COLUMN "photoEmoji" TEXT;

-- Backfill: pale-blue → white gradient mirrors the existing PrestasiCard chrome.
UPDATE "Achievement"
  SET "photoFrom"  = '#E0F2FE',
      "photoTo"    = '#FFFFFF',
      "photoEmoji" = "icon",
      "photoKind"  = 'gradient';

ALTER TABLE "Achievement" DROP COLUMN "icon";
