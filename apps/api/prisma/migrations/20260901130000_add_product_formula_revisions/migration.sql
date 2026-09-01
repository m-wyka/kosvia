-- CreateTable
CREATE TABLE "product_formula_revisions" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "compositionHash" TEXT NOT NULL,
    "composition" JSONB NOT NULL,
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_formula_revisions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "product_formula_revisions_productId_createdAt_idx" ON "product_formula_revisions"("productId", "createdAt");
CREATE INDEX "product_formula_revisions_createdAt_idx" ON "product_formula_revisions"("createdAt");

ALTER TABLE "product_formula_revisions" ADD CONSTRAINT "product_formula_revisions_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_formula_revisions" ADD CONSTRAINT "product_formula_revisions_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "data_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
