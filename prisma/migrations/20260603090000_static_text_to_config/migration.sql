-- Static text (page sections, site config, navigation) moved to src/config/ and is
-- read directly by the assemblers; these DB tables are now redundant. The 6 admin-
-- editable section photos move to the new SectionPhoto table below.

-- Defensive: drop any MediaUsage rows that pointed at the old PageSection photo slots
-- (0 in dev, but future-proof so the media library never shows a phantom usage).
DELETE FROM `MediaUsage` WHERE `usedInTable` = 'PageSection';

-- DropTable
DROP TABLE `Navigation`;

-- DropTable
DROP TABLE `PageSection`;

-- DropTable
DROP TABLE `SiteConfig`;

-- CreateTable
CREATE TABLE `SectionPhoto` (
    `pageKey` VARCHAR(191) NOT NULL,
    `sectionKey` VARCHAR(191) NOT NULL,
    `field` VARCHAR(191) NOT NULL,
    `photoKind` VARCHAR(191) NULL,
    `photoSrc` VARCHAR(255) NULL,
    `photoAlt` TEXT NULL,
    `photoFrom` VARCHAR(191) NULL,
    `photoTo` VARCHAR(191) NULL,
    `photoEmoji` VARCHAR(191) NULL,
    `photoCropX` DOUBLE NULL,
    `photoCropY` DOUBLE NULL,
    `photoCropW` DOUBLE NULL,
    `photoCropH` DOUBLE NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `updatedBy` VARCHAR(191) NULL,

    PRIMARY KEY (`pageKey`, `sectionKey`, `field`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

