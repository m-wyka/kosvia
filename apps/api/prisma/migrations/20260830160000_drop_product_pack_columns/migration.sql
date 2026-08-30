-- Step 3 of 3 (03_MODEL_DANYCH.md §3): the pack now lives on product_variants.
-- Requires `variants:backfill` to have run — every offer and price point must
-- already know its variant.

-- Guard: refuse to drop data that has not been carried over.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "product_offers" WHERE "variantId" IS NULL)
     OR EXISTS (SELECT 1 FROM "price_history" WHERE "variantId" IS NULL) THEN
    RAISE EXCEPTION 'run variants:backfill before this migration';
  END IF;
END $$;

-- product_offers: the pack is the owner
ALTER TABLE "product_offers" DROP CONSTRAINT "product_offers_productId_fkey";
DROP INDEX "product_offers_productId_storeId_key";
DROP INDEX "product_offers_productId_price_idx";
ALTER TABLE "product_offers" DROP COLUMN "productId";
ALTER TABLE "product_offers" ALTER COLUMN "variantId" SET NOT NULL;

-- price_history
ALTER TABLE "price_history" DROP CONSTRAINT "price_history_productId_fkey";
DROP INDEX "price_history_productId_recordedAt_idx";
ALTER TABLE "price_history" DROP COLUMN "productId";
ALTER TABLE "price_history" ALTER COLUMN "variantId" SET NOT NULL;

-- products: pack columns move out
DROP INDEX "products_ean_key";
ALTER TABLE "products"
    DROP COLUMN "ean",
    DROP COLUMN "imageUrl",
    DROP COLUMN "volume",
    DROP COLUMN "volumeUnit";
