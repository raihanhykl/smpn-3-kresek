-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'EDITOR') NOT NULL,
    `mustChangePassword` BOOLEAN NOT NULL DEFAULT false,
    `passwordChangedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastLoginAt` DATETIME(3) NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,

    INDEX `Session_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `target` VARCHAR(191) NOT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `AuditLog_target_createdAt_idx`(`target`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PageSection` (
    `id` VARCHAR(191) NOT NULL,
    `pageKey` VARCHAR(191) NOT NULL,
    `sectionKey` VARCHAR(191) NOT NULL,
    `data` JSON NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `updatedBy` VARCHAR(191) NULL,

    UNIQUE INDEX `PageSection_pageKey_sectionKey_key`(`pageKey`, `sectionKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SiteConfig` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'singleton',
    `data` JSON NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `updatedBy` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Navigation` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'singleton',
    `items` JSON NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `updatedBy` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Teacher` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `position` VARCHAR(191) NOT NULL,
    `badge` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `categoryOrder` INTEGER NOT NULL DEFAULT 0,
    `photoKind` VARCHAR(191) NOT NULL,
    `photoSrc` VARCHAR(191) NULL,
    `photoAlt` TEXT NULL,
    `photoFrom` VARCHAR(191) NULL,
    `photoTo` VARCHAR(191) NULL,
    `photoEmoji` VARCHAR(191) NULL,
    `photoCropX` DOUBLE NULL,
    `photoCropY` DOUBLE NULL,
    `photoCropW` DOUBLE NULL,
    `photoCropH` DOUBLE NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Teacher_categoryOrder_order_idx`(`categoryOrder`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Achievement` (
    `id` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `recipient` VARCHAR(191) NOT NULL,
    `organizer` VARCHAR(191) NOT NULL,
    `level` VARCHAR(191) NOT NULL,
    `photoKind` VARCHAR(191) NOT NULL DEFAULT 'gradient',
    `photoSrc` VARCHAR(191) NULL,
    `photoAlt` TEXT NULL,
    `photoFrom` VARCHAR(191) NULL,
    `photoTo` VARCHAR(191) NULL,
    `photoEmoji` VARCHAR(191) NULL,
    `photoCropX` DOUBLE NULL,
    `photoCropY` DOUBLE NULL,
    `photoCropW` DOUBLE NULL,
    `photoCropH` DOUBLE NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Achievement_year_order_idx`(`year`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Extracurricular` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `categoryOrder` INTEGER NOT NULL DEFAULT 0,
    `description` TEXT NOT NULL,
    `pembina` VARCHAR(191) NOT NULL,
    `schedule` VARCHAR(191) NOT NULL,
    `achievement` VARCHAR(191) NULL,
    `photoKind` VARCHAR(191) NOT NULL DEFAULT 'gradient',
    `photoSrc` VARCHAR(191) NULL,
    `photoAlt` TEXT NULL,
    `photoFrom` VARCHAR(191) NULL,
    `photoTo` VARCHAR(191) NULL,
    `photoEmoji` VARCHAR(191) NULL,
    `photoCropX` DOUBLE NULL,
    `photoCropY` DOUBLE NULL,
    `photoCropW` DOUBLE NULL,
    `photoCropH` DOUBLE NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Extracurricular_categoryOrder_order_idx`(`categoryOrder`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Subject` (
    `id` VARCHAR(191) NOT NULL,
    `group` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `icon` VARCHAR(191) NOT NULL,
    `iconBg` VARCHAR(191) NOT NULL,
    `hoursByGrade` JSON NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Subject_order_idx`(`order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Faq` (
    `id` VARCHAR(191) NOT NULL,
    `question` TEXT NOT NULL,
    `answer` TEXT NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Faq_category_order_idx`(`category`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GalleryItem` (
    `id` VARCHAR(191) NOT NULL,
    `caption` TEXT NOT NULL,
    `photoKind` VARCHAR(191) NOT NULL DEFAULT 'gradient',
    `photoSrc` VARCHAR(191) NULL,
    `photoAlt` TEXT NULL,
    `photoFrom` VARCHAR(191) NULL,
    `photoTo` VARCHAR(191) NULL,
    `photoEmoji` VARCHAR(191) NULL,
    `photoCropX` DOUBLE NULL,
    `photoCropY` DOUBLE NULL,
    `photoCropW` DOUBLE NULL,
    `photoCropH` DOUBLE NULL,
    `category` VARCHAR(191) NULL,
    `span` VARCHAR(191) NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `GalleryItem_category_order_idx`(`category`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Facility` (
    `id` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `photoKind` VARCHAR(191) NULL,
    `photoSrc` VARCHAR(191) NULL,
    `photoAlt` TEXT NULL,
    `photoFrom` VARCHAR(191) NULL,
    `photoTo` VARCHAR(191) NULL,
    `photoEmoji` VARCHAR(191) NULL,
    `photoCropX` DOUBLE NULL,
    `photoCropY` DOUBLE NULL,
    `photoCropW` DOUBLE NULL,
    `photoCropH` DOUBLE NULL,
    `span` VARCHAR(191) NULL,
    `icon` VARCHAR(191) NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Facility_kind_order_idx`(`kind`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrganizationMember` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `level` INTEGER NOT NULL,
    `parentId` VARCHAR(191) NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `OrganizationMember_level_order_idx`(`level`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DocumentSlot` (
    `id` VARCHAR(191) NOT NULL,
    `mediaId` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `updatedBy` VARCHAR(191) NULL,

    INDEX `DocumentSlot_mediaId_idx`(`mediaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MediaAsset` (
    `id` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `url` VARCHAR(500) NOT NULL,
    `publicId` VARCHAR(255) NOT NULL,
    `hash` VARCHAR(255) NOT NULL,
    `alt` TEXT NULL,
    `filename` VARCHAR(255) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `uploadedBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MediaAsset_publicId_key`(`publicId`),
    UNIQUE INDEX `MediaAsset_hash_key`(`hash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MediaUsage` (
    `id` VARCHAR(191) NOT NULL,
    `mediaId` VARCHAR(191) NOT NULL,
    `usedInTable` VARCHAR(191) NOT NULL,
    `usedInId` VARCHAR(191) NOT NULL,
    `usedInField` VARCHAR(191) NOT NULL,

    INDEX `MediaUsage_mediaId_idx`(`mediaId`),
    INDEX `MediaUsage_usedInTable_usedInId_idx`(`usedInTable`, `usedInId`),
    UNIQUE INDEX `MediaUsage_mediaId_usedInTable_usedInId_usedInField_key`(`mediaId`, `usedInTable`, `usedInId`, `usedInField`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrganizationMember` ADD CONSTRAINT `OrganizationMember_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `OrganizationMember`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DocumentSlot` ADD CONSTRAINT `DocumentSlot_mediaId_fkey` FOREIGN KEY (`mediaId`) REFERENCES `MediaAsset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MediaUsage` ADD CONSTRAINT `MediaUsage_mediaId_fkey` FOREIGN KEY (`mediaId`) REFERENCES `MediaAsset`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
