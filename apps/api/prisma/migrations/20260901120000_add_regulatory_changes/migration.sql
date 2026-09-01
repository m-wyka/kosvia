-- CreateEnum
CREATE TYPE "RegulatoryChangeKind" AS ENUM ('BECAME_PROHIBITED', 'BECAME_RESTRICTED', 'PROHIBITION_LIFTED', 'RESTRICTION_LIFTED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "regulatoryAlertsSeenAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "regulatory_changes" (
    "id" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "kind" "RegulatoryChangeKind" NOT NULL,
    "previousAnnex" TEXT,
    "newAnnex" TEXT,
    "importRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "regulatory_changes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "regulatory_changes_createdAt_idx" ON "regulatory_changes"("createdAt");
CREATE INDEX "regulatory_changes_ingredientId_idx" ON "regulatory_changes"("ingredientId");

ALTER TABLE "regulatory_changes" ADD CONSTRAINT "regulatory_changes_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "regulatory_changes" ADD CONSTRAINT "regulatory_changes_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "import_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
