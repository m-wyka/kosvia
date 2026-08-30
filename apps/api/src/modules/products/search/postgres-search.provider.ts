import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ProductSuggestionDto } from '@kosvia/shared';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  isEanQuery,
  mergeCandidates,
  type RankedCandidate,
  type SearchProvider,
} from './search-provider';

/** Below this many full-text hits the fuzzy pass runs too (typos, partial names). */
const FUZZY_FALLBACK_THRESHOLD = 5;
const NAME_SIMILARITY_WEIGHT = 0.6;
const BRAND_SIMILARITY_WEIGHT = 0.6;
const INGREDIENT_MATCH_BONUS = 0.5;
const HAS_OFFER_BONUS = 0.2;
/** Fuzzy hits rank below any full-text hit unless the name is nearly identical. */
const FUZZY_RANK_SCALE = 0.5;
const FUZZY_CATEGORY_WEIGHT = 0.6;
/** An ingredient hit counts less than a name hit, and less the further down the INCI list it sits. */
const FUZZY_INGREDIENT_WEIGHT = 0.7;

interface RankedRow {
  id: string;
  rank: number;
}

@Injectable()
export class PostgresSearchProvider implements SearchProvider {
  constructor(private readonly prisma: PrismaService) {}

  async rankedCandidates(query: string, limit: number): Promise<RankedCandidate[]> {
    const term = query.trim();
    if (!term) {
      return [];
    }
    if (isEanQuery(term)) {
      return this.byEan(term);
    }
    const fullText = await this.fullText(term, limit);
    if (fullText.length >= FUZZY_FALLBACK_THRESHOLD) {
      return fullText;
    }
    const fuzzy = await this.fuzzy(term, limit);
    return mergeCandidates(fullText, fuzzy).slice(0, limit);
  }

  async suggest(query: string, limit: number): Promise<ProductSuggestionDto[]> {
    const term = query.trim();
    if (!term) {
      return [];
    }
    if (isEanQuery(term)) {
      return this.prisma.$queryRaw<ProductSuggestionDto[]>(Prisma.sql`
        SELECT p."id", p."name", p."slug", b."name" AS "brandName", v."imageUrl"
        FROM "products" p
        JOIN "brands" b ON b."id" = p."brandId"
        JOIN "product_variants" v ON v."productId" = p."id"
        WHERE p."isActive" AND v."ean" = ${term}
        LIMIT ${limit}
      `);
    }
    return this.prisma.$queryRaw<ProductSuggestionDto[]>(Prisma.sql`
      WITH q AS (SELECT f_unaccent(${term}) AS term)
      SELECT p."id", p."name", p."slug", b."name" AS "brandName", v."imageUrl"
      FROM "products" p
      JOIN "brands" b ON b."id" = p."brandId"
      LEFT JOIN "product_variants" v ON v."productId" = p."id" AND v."isDefault", q
      WHERE p."isActive"
        AND (
          f_unaccent(p."name") ILIKE q.term || '%'
          OR f_unaccent(p."name") % q.term
          OR f_unaccent(b."name") % q.term
        )
      ORDER BY GREATEST(
          similarity(f_unaccent(p."name"), q.term),
          similarity(f_unaccent(b."name"), q.term)
        ) DESC,
        p."name" ASC
      LIMIT ${limit}
    `);
  }

  private async byEan(ean: string): Promise<RankedCandidate[]> {
    const rows = await this.prisma.product.findMany({
      where: { isActive: true, variants: { some: { ean } } },
      select: { id: true },
    });
    return rows.map((row) => ({ id: row.id, rank: 1 }));
  }

  private fullText(term: string, limit: number): Promise<RankedRow[]> {
    return this.prisma.$queryRaw<RankedRow[]>(Prisma.sql`
      WITH q AS (
        SELECT plainto_tsquery('simple', f_unaccent(${term})) AS tsq, f_unaccent(${term}) AS term
      )
      SELECT p."id",
        (
          ts_rank_cd(p."searchVector", q.tsq)
          + similarity(f_unaccent(p."name"), q.term) * ${NAME_SIMILARITY_WEIGHT}
          + similarity(f_unaccent(b."name"), q.term) * ${BRAND_SIMILARITY_WEIGHT}
          + CASE WHEN EXISTS (
              SELECT 1 FROM "product_ingredients" pi
              JOIN "ingredients" i ON i."id" = pi."ingredientId"
              WHERE pi."productId" = p."id" AND i."normalizedName" = lower(q.term)
            ) THEN ${INGREDIENT_MATCH_BONUS} ELSE 0 END
          + CASE WHEN p."lowestPrice" IS NOT NULL THEN ${HAS_OFFER_BONUS} ELSE 0 END
        )::float8 AS rank
      FROM "products" p
      JOIN "brands" b ON b."id" = p."brandId", q
      WHERE p."isActive"
        AND (
          p."searchVector" @@ q.tsq
          OR f_unaccent(b."name") % q.term
          OR EXISTS (
            SELECT 1 FROM "product_ingredients" pi
            JOIN "ingredients" i ON i."id" = pi."ingredientId"
            WHERE pi."productId" = p."id" AND i."normalizedName" = lower(q.term)
          )
        )
      ORDER BY rank DESC, p."id" DESC
      LIMIT ${limit}
    `);
  }

  private fuzzy(term: string, limit: number): Promise<RankedRow[]> {
    return this.prisma.$queryRaw<RankedRow[]>(Prisma.sql`
      WITH q AS (SELECT f_unaccent(${term}) AS term)
      SELECT p."id",
        (
          (
            similarity(f_unaccent(p."name"), q.term)
            + similarity(f_unaccent(b."name"), q.term)
            + similarity(f_unaccent(c."name"), q.term) * ${FUZZY_CATEGORY_WEIGHT}
            + COALESCE((
                SELECT MAX(similarity(i."normalizedName", lower(q.term)) / (1 + ln(pi."position")))
                FROM "product_ingredients" pi
                JOIN "ingredients" i ON i."id" = pi."ingredientId"
                WHERE pi."productId" = p."id" AND i."normalizedName" % lower(q.term)
              ), 0) * ${FUZZY_INGREDIENT_WEIGHT}
          ) * ${FUZZY_RANK_SCALE}
        )::float8 AS rank
      FROM "products" p
      JOIN "brands" b ON b."id" = p."brandId"
      JOIN "categories" c ON c."id" = p."categoryId", q
      WHERE p."isActive"
        AND (
          f_unaccent(p."name") % q.term
          OR f_unaccent(b."name") % q.term
          OR f_unaccent(c."name") % q.term
          OR EXISTS (
            SELECT 1 FROM "product_ingredients" pi
            JOIN "ingredients" i ON i."id" = pi."ingredientId"
            WHERE pi."productId" = p."id" AND i."normalizedName" % lower(q.term)
          )
        )
      ORDER BY rank DESC, p."id" DESC
      LIMIT ${limit}
    `);
  }
}
