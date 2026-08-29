-- CreateEnum
CREATE TYPE "AliasKind" AS ENUM ('SYNONYM', 'TRANSLATION', 'TYPO', 'TRADE_NAME', 'CI_NUMBER');

-- AlterTable: additive only, rawText stays nullable until backfilled
ALTER TABLE "product_ingredients"
    ADD COLUMN "rawText" TEXT,
    ADD COLUMN "isAfterMayContain" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "matchConfidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0;

-- CreateTable
CREATE TABLE "ingredient_aliases" (
    "id" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "aliasRaw" TEXT NOT NULL,
    "kind" "AliasKind" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,

    CONSTRAINT "ingredient_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ingredient_aliases_alias_key" ON "ingredient_aliases"("alias");

-- CreateIndex
CREATE INDEX "ingredient_aliases_ingredientId_idx" ON "ingredient_aliases"("ingredientId");

-- AddForeignKey
ALTER TABLE "ingredient_aliases" ADD CONSTRAINT "ingredient_aliases_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
