/*
  Warnings:

  - You are about to drop the column `grade` on the `Subject` table. All the data in the column will be lost.
  - You are about to drop the column `groupId` on the `Subject` table. All the data in the column will be lost.
  - You are about to drop the column `groupTitle` on the `Subject` table. All the data in the column will be lost.
  - You are about to drop the column `hours` on the `Subject` table. All the data in the column will be lost.
  - Added the required column `group` to the `Subject` table without a default value. This is not possible if the table is not empty.
  - Added the required column `hoursByGrade` to the `Subject` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Subject_grade_order_idx";

-- AlterTable
ALTER TABLE "Subject" DROP COLUMN "grade",
DROP COLUMN "groupId",
DROP COLUMN "groupTitle",
DROP COLUMN "hours",
ADD COLUMN     "group" TEXT NOT NULL,
ADD COLUMN     "hoursByGrade" JSONB NOT NULL;

-- CreateIndex
CREATE INDEX "Subject_order_idx" ON "Subject"("order");
