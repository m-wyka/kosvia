-- Step 1 of 3 (03_MODEL_DANYCH.md §3): add the variant entity next to the old
-- columns. Nothing is moved or dropped here — see `variants:backfill` and the
-- follow-up migration that removes ean/volume/imageUrl from products.

-- CreateEnum
CREATE TYPE "VolumeUnit" AS ENUM ('ML', 'G', 'PIECE');

-- CreateTable
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "ean" TEXT,
    "volume" DECIMAL(10,2),
    "volumeUnit" "VolumeUnit" NOT NULL DEFAULT 'ML',
    "imageUrl" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sourceRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_variants_ean_key" ON "product_variants"("ean");
CREATE INDEX "product_variants_productId_idx" ON "product_variants"("productId");
-- Exactly one default variant per product.
CREATE UNIQUE INDEX "product_variants_one_default_per_product" ON "product_variants"("productId") WHERE "isDefault";

ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: offers and price points learn which pack they belong to
ALTER TABLE "product_offers" ADD COLUMN "variantId" TEXT;
CREATE UNIQUE INDEX "product_offers_variantId_storeId_key" ON "product_offers"("variantId", "storeId");
CREATE INDEX "product_offers_variantId_price_idx" ON "product_offers"("variantId", "price");
ALTER TABLE "product_offers" ADD CONSTRAINT "product_offers_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "price_history" ADD COLUMN "variantId" TEXT;
CREATE INDEX "price_history_variantId_recordedAt_idx" ON "price_history"("variantId", "recordedAt");
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
