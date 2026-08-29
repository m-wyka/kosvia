-- CreateTable
CREATE TABLE "match_weight_sets" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "weights" JSONB NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_weight_sets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "match_weight_sets_version_key" ON "match_weight_sets"("version");
CREATE INDEX "match_weight_sets_isActive_idx" ON "match_weight_sets"("isActive");
