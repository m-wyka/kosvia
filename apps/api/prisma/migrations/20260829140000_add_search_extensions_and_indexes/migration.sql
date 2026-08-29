-- Extensions (both ship with contrib; pgvector is added separately when ProductTraits lands)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent() is STABLE, generated columns need IMMUTABLE: wrap it with the dictionary pinned.
CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS
$$ SELECT public.unaccent('public.unaccent', $1) $$;

-- array_to_string() is only STABLE; a generated column needs an IMMUTABLE expression.
CREATE OR REPLACE FUNCTION f_join_text(text[]) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS
$$ SELECT array_to_string($1, ' ') $$;

-- Full-text vector over the product's own text; brand and category are matched by trigram through their tables.
ALTER TABLE "products" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
       setweight(to_tsvector('simple', f_unaccent(coalesce("name", ''))), 'A')
    || setweight(to_tsvector('simple', f_unaccent(f_join_text(coalesce("highlights", ARRAY[]::text[])))), 'B')
    || setweight(to_tsvector('simple', f_unaccent(coalesce("description", ''))), 'C')
  ) STORED;

CREATE INDEX "products_searchVector_idx" ON "products" USING GIN ("searchVector");

-- Trigram indexes for typo-tolerant matching and suggestions
CREATE INDEX "products_name_trgm_idx" ON "products" USING GIN (f_unaccent("name") gin_trgm_ops);
CREATE INDEX "brands_name_trgm_idx" ON "brands" USING GIN (f_unaccent("name") gin_trgm_ops);
CREATE INDEX "categories_name_trgm_idx" ON "categories" USING GIN (f_unaccent("name") gin_trgm_ops);
CREATE INDEX "ingredients_normalizedName_trgm_idx" ON "ingredients" USING GIN ("normalizedName" gin_trgm_ops);
