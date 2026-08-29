-- AlterTable
ALTER TABLE "ingredients" ALTER COLUMN "normalizedName" SET NOT NULL;

-- CreateIndex
CREATE INDEX "ingredients_normalizedName_idx" ON "ingredients"("normalizedName");
