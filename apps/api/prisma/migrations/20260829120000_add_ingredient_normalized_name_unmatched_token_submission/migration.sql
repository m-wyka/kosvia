-- CreateEnum
CREATE TYPE "TokenStatus" AS ENUM ('PENDING', 'MAPPED', 'NEW_INGREDIENT', 'IGNORED');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable: nullable until backfilled
ALTER TABLE "ingredients" ADD COLUMN "normalizedName" TEXT;

-- CreateTable
CREATE TABLE "unmatched_tokens" (
    "id" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "rawSamples" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
    "suggestedIngredientId" TEXT,
    "suggestedScore" DOUBLE PRECISION,
    "status" "TokenStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unmatched_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_submissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "productId" TEXT,
    "ean" TEXT,
    "imageUrl" TEXT,
    "rawLabel" TEXT,
    "extractedText" TEXT,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unmatched_tokens_normalized_key" ON "unmatched_tokens"("normalized");

-- CreateIndex
CREATE INDEX "unmatched_tokens_status_occurrenceCount_idx" ON "unmatched_tokens"("status", "occurrenceCount");

-- CreateIndex
CREATE INDEX "product_submissions_status_createdAt_idx" ON "product_submissions"("status", "createdAt");

-- CreateIndex
CREATE INDEX "product_submissions_ean_idx" ON "product_submissions"("ean");

-- AddForeignKey
ALTER TABLE "unmatched_tokens" ADD CONSTRAINT "unmatched_tokens_suggestedIngredientId_fkey" FOREIGN KEY ("suggestedIngredientId") REFERENCES "ingredients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_submissions" ADD CONSTRAINT "product_submissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_submissions" ADD CONSTRAINT "product_submissions_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
