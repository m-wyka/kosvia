-- AlterTable: Polish prose next to the English columns
ALTER TABLE "ingredients"
    ADD COLUMN "commonNamePl" TEXT,
    ADD COLUMN "descriptionPl" TEXT,
    ADD COLUMN "functionsPl" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "concernsPl" TEXT;
