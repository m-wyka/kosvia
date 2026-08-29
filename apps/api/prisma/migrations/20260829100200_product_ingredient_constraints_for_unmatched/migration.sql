-- rawText is now the source of truth and must always be present
ALTER TABLE "product_ingredients" ALTER COLUMN "rawText" SET NOT NULL;

-- ingredientId becomes optional: unmatched label tokens keep their row
ALTER TABLE "product_ingredients" ALTER COLUMN "ingredientId" DROP NOT NULL;

-- Deleting a dictionary entry no longer deletes the label row — it unmatches it
ALTER TABLE "product_ingredients" DROP CONSTRAINT "product_ingredients_ingredientId_fkey";
ALTER TABLE "product_ingredients" ADD CONSTRAINT "product_ingredients_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The same ingredient may legitimately appear twice; position is the real key
DROP INDEX "product_ingredients_productId_ingredientId_key";
DROP INDEX "product_ingredients_productId_position_idx";
CREATE UNIQUE INDEX "product_ingredients_productId_position_key" ON "product_ingredients"("productId", "position");
