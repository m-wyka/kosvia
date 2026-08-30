-- AlterTable: regulatory and identification facts from CosIng
ALTER TABLE "ingredients"
    ADD COLUMN "cosIngRef" TEXT,
    ADD COLUMN "casNumber" TEXT,
    ADD COLUMN "ecNumber" TEXT,
    ADD COLUMN "innName" TEXT,
    ADD COLUMN "chemicalDescription" TEXT,
    ADD COLUMN "isFragranceAllergen" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "isRestricted" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "isProhibited" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "cosIngAnnex" TEXT,
    ADD COLUMN "restrictionNote" TEXT,
    ADD COLUMN "isManuallyEdited" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "descriptionGeneratedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "ingredients_cosIngRef_key" ON "ingredients"("cosIngRef");
CREATE INDEX "ingredients_isFragranceAllergen_idx" ON "ingredients"("isFragranceAllergen");

-- CreateTable
CREATE TABLE "ingredient_functions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cosIngRef" TEXT,

    CONSTRAINT "ingredient_functions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ingredient_functions_code_key" ON "ingredient_functions"("code");
CREATE UNIQUE INDEX "ingredient_functions_cosIngRef_key" ON "ingredient_functions"("cosIngRef");

-- CreateTable
CREATE TABLE "ingredient_functions_on_ingredients" (
    "ingredientId" TEXT NOT NULL,
    "functionId" TEXT NOT NULL,

    CONSTRAINT "ingredient_functions_on_ingredients_pkey" PRIMARY KEY ("ingredientId", "functionId")
);

CREATE INDEX "ingredient_functions_on_ingredients_functionId_idx" ON "ingredient_functions_on_ingredients"("functionId");

-- AddForeignKey
ALTER TABLE "ingredient_functions_on_ingredients" ADD CONSTRAINT "ingredient_functions_on_ingredients_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ingredient_functions_on_ingredients" ADD CONSTRAINT "ingredient_functions_on_ingredients_functionId_fkey" FOREIGN KEY ("functionId") REFERENCES "ingredient_functions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
