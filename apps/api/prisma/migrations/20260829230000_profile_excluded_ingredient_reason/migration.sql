-- CreateEnum
CREATE TYPE "ExclusionReason" AS ENUM ('ALLERGY', 'PREFERENCE');

-- CreateTable: explicit join so each exclusion can carry a reason
CREATE TABLE "profile_excluded_ingredients" (
    "profileId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "reason" "ExclusionReason" NOT NULL DEFAULT 'PREFERENCE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_excluded_ingredients_pkey" PRIMARY KEY ("profileId", "ingredientId")
);

-- Data: carry over existing exclusions (implicit m2m table: A = beauty_profiles.id, B = ingredients.id)
INSERT INTO "profile_excluded_ingredients" ("profileId", "ingredientId")
SELECT "A", "B" FROM "_ProfileExcludedIngredients"
ON CONFLICT DO NOTHING;

-- CreateIndex
CREATE INDEX "profile_excluded_ingredients_ingredientId_idx" ON "profile_excluded_ingredients"("ingredientId");

-- AddForeignKey
ALTER TABLE "profile_excluded_ingredients" ADD CONSTRAINT "profile_excluded_ingredients_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "beauty_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "profile_excluded_ingredients" ADD CONSTRAINT "profile_excluded_ingredients_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropTable: the implicit relation is gone from the schema
DROP TABLE "_ProfileExcludedIngredients";
