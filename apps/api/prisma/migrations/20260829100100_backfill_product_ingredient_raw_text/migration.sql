-- Data only: every existing row was matched to the dictionary, so the label
-- text is the INCI name. Idempotent — safe to re-run.
UPDATE "product_ingredients" AS pi
SET "rawText" = i."inciName"
FROM "ingredients" AS i
WHERE pi."ingredientId" = i."id"
  AND pi."rawText" IS NULL;
