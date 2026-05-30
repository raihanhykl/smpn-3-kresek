-- Phase 3b: Facility-featured migrates to shared Photo discriminated union.
-- Facility-mini stays icon-only (photoKind NULL, icon NOT NULL).
-- All existing featured rows backfill to gradient. CHECK constraint
-- enforces the per-kind invariant at the DB level.

-- 1. add nullable Photo columns
ALTER TABLE "Facility"
  ADD COLUMN "photoKind"  TEXT,
  ADD COLUMN "photoSrc"   TEXT,
  ADD COLUMN "photoAlt"   TEXT,
  ADD COLUMN "photoFrom"  TEXT,
  ADD COLUMN "photoTo"    TEXT,
  ADD COLUMN "photoEmoji" TEXT;

-- 2. backfill featured rows from legacy columns
UPDATE "Facility"
  SET "photoKind"  = 'gradient',
      "photoFrom"  = "gradientFrom",
      "photoTo"    = "gradientTo",
      "photoEmoji" = "emoji"
  WHERE "kind" = 'featured';

-- 3. drop legacy featured-only columns
ALTER TABLE "Facility"
  DROP COLUMN "gradientFrom",
  DROP COLUMN "gradientTo",
  DROP COLUMN "emoji";

-- 4. CHECK constraint: featured rows must have a non-null photoKind;
--    mini rows must have NULL photoKind. icon is similarly per-kind.
ALTER TABLE "Facility"
  ADD CONSTRAINT "facility_kind_photo_invariant"
  CHECK (
    ("kind" = 'featured' AND "photoKind" IS NOT NULL AND "icon" IS NULL)
    OR
    ("kind" = 'mini' AND "photoKind" IS NULL AND "icon" IS NOT NULL)
  );
