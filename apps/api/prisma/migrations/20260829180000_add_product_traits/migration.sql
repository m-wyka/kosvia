-- pgvector ships in the compose image (pgvector/pgvector:pg16)
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "product_traits" (
    "productId" TEXT NOT NULL,
    "hasFragrance" BOOLEAN NOT NULL DEFAULT false,
    "hasFragranceAllergen" BOOLEAN NOT NULL DEFAULT false,
    "hasAlcoholDenat" BOOLEAN NOT NULL DEFAULT false,
    "alcoholDenatPosition" INTEGER,
    "hasEssentialOils" BOOLEAN NOT NULL DEFAULT false,
    "hasSilicones" BOOLEAN NOT NULL DEFAULT false,
    "hasSpf" BOOLEAN NOT NULL DEFAULT false,
    "humectantScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "emollientScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "occlusiveScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "antioxidantScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "exfoliantScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "soothingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "brighteningScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "antiAgingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sebumRegulationScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "skinFitDry" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "skinFitOily" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "skinFitCombination" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "skinFitNormal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "skinFitSensitive" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "calmingLoad" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "irritantLoad" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "activeIngredientIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "concernSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "goalSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fingerprint" vector(64),
    "ingredientCount" INTEGER NOT NULL DEFAULT 0,
    "recognizedRatio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dataCompleteness" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "traitsVersion" INTEGER NOT NULL DEFAULT 1,
    "computedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_traits_pkey" PRIMARY KEY ("productId")
);

-- CreateIndex
CREATE INDEX "product_traits_activeIngredientIds_idx" ON "product_traits" USING GIN ("activeIngredientIds");
CREATE INDEX "product_traits_concernSlugs_idx" ON "product_traits" USING GIN ("concernSlugs");
CREATE INDEX "product_traits_goalSlugs_idx" ON "product_traits" USING GIN ("goalSlugs");
CREATE INDEX "product_traits_hasFragrance_hasSpf_idx" ON "product_traits"("hasFragrance", "hasSpf");
CREATE INDEX "product_traits_fingerprint_idx" ON "product_traits" USING hnsw ("fingerprint" vector_cosine_ops);

-- AddForeignKey
ALTER TABLE "product_traits" ADD CONSTRAINT "product_traits_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
