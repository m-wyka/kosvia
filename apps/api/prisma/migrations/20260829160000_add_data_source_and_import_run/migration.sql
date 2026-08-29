-- CreateEnum
CREATE TYPE "ImportRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'INTERRUPTED');

-- CreateTable
CREATE TABLE "data_sources" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "license" TEXT NOT NULL,
    "attribution" TEXT,
    "url" TEXT,

    CONSTRAINT "data_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_runs" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" "ImportRunStatus" NOT NULL DEFAULT 'RUNNING',
    "isDryRun" BOOLEAN NOT NULL DEFAULT false,
    "params" JSONB,
    "cursor" JSONB,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "queued" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "errors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "import_runs_pkey" PRIMARY KEY ("id")
);

-- AlterTable: provenance columns, all nullable so existing rows are untouched
ALTER TABLE "products"
    ADD COLUMN "sourceId" TEXT,
    ADD COLUMN "sourceRef" TEXT,
    ADD COLUMN "sourceUpdatedAt" TIMESTAMP(3),
    ADD COLUMN "isManuallyEdited" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ingredients" ADD COLUMN "sourceId" TEXT;

ALTER TABLE "product_ingredients"
    ADD COLUMN "sourceId" TEXT,
    ADD COLUMN "isManuallyEdited" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "product_offers" ADD COLUMN "sourceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "data_sources_code_key" ON "data_sources"("code");
CREATE INDEX "import_runs_sourceId_startedAt_idx" ON "import_runs"("sourceId", "startedAt");
CREATE UNIQUE INDEX "products_sourceId_sourceRef_key" ON "products"("sourceId", "sourceRef");

-- AddForeignKey
ALTER TABLE "import_runs" ADD CONSTRAINT "import_runs_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "data_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "data_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "data_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "product_ingredients" ADD CONSTRAINT "product_ingredients_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "data_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "product_offers" ADD CONSTRAINT "product_offers_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "data_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
