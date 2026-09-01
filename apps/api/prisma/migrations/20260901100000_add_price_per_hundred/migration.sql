-- AlterTable
ALTER TABLE "products" ADD COLUMN "pricePerHundred" DECIMAL(10,2);

CREATE INDEX "products_pricePerHundred_idx" ON "products"("pricePerHundred");

-- Backfill from the default variant's cheapest in-stock offer.
UPDATE "products" AS p
SET "pricePerHundred" = sub.per_hundred
FROM (
  SELECT v."productId" AS product_id,
         CASE
           WHEN v."volume" IS NULL OR v."volume" <= 0 OR v."volumeUnit" = 'PIECE' THEN NULL
           ELSE ROUND(MIN(o."price") / v."volume" * 100, 2)
         END AS per_hundred
  FROM "product_variants" v
  JOIN "product_offers" o ON o."variantId" = v."id" AND o."availability" <> 'OUT_OF_STOCK'
  WHERE v."isDefault"
  GROUP BY v."productId", v."volume", v."volumeUnit"
) AS sub
WHERE p."id" = sub.product_id;
