-- Data only. Mirrors normalizeToken() in the INCI parser for the ASCII subset:
-- lowercase, strip parentheticals, keep [a-z0-9 -], collapse whitespace.
-- Idempotent — safe to re-run.
UPDATE "ingredients"
SET "normalizedName" = btrim(
  regexp_replace(
    regexp_replace(
      regexp_replace(lower("inciName"), '\([^)]*\)', '', 'g'),
      '[^a-z0-9 -]', ' ', 'g'
    ),
    '\s+', ' ', 'g'
  )
)
WHERE "normalizedName" IS NULL;
