-- AlterTable
ALTER TABLE "categories" ADD COLUMN "paoMonths" INTEGER;
ALTER TABLE "products" ADD COLUMN "paoMonths" INTEGER;

-- Backfill typical period-after-opening per routine step.
UPDATE "categories" SET "paoMonths" = CASE "routineStep"
  WHEN 'SPF' THEN 12
  WHEN 'MOISTURIZER' THEN 12
  WHEN 'CLEANSER' THEN 12
  WHEN 'TONER' THEN 12
  WHEN 'SERUM' THEN 9
  WHEN 'EYE' THEN 6
  WHEN 'EXFOLIANT' THEN 12
  WHEN 'MASK' THEN 12
  WHEN 'TREATMENT' THEN 9
  WHEN 'BODY' THEN 12
  WHEN 'HAIR' THEN 12
  WHEN 'MAKEUP' THEN 12
  ELSE NULL
END;
