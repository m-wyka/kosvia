import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { isCiNumber } from './inci-parser';

export type MatchLevel = 'INCI_NAME' | 'ALIAS' | 'CI_NUMBER';

export interface IngredientMatch {
  ingredientId: string;
  confidence: number;
  level: MatchLevel;
}

export interface IngredientSuggestion {
  ingredientId: string;
  score: number;
}

export const MATCH_CONFIDENCE: Record<MatchLevel, number> = {
  INCI_NAME: 1,
  ALIAS: 0.95,
  CI_NUMBER: 0.95,
};

/** Spec 07 §2: below this trigram score a token is simply unknown. */
export const SUGGESTION_MIN_SIMILARITY = 0.6;

/**
 * Resolves normalised label tokens to dictionary entries. Levels 1–3 are
 * exact lookups and write a match; level 4 (trigrams) only ever proposes.
 */
@Injectable()
export class InciMatcherService {
  constructor(private readonly prisma: PrismaService) {}

  async matchMany(normalizedTokens: string[]): Promise<Map<string, IngredientMatch>> {
    const unique = [...new Set(normalizedTokens.filter(Boolean))];
    const matches = new Map<string, IngredientMatch>();
    if (!unique.length) {
      return matches;
    }

    const [byName, byAlias] = await Promise.all([
      this.prisma.ingredient.findMany({
        where: { normalizedName: { in: unique } },
        select: { id: true, normalizedName: true },
      }),
      this.prisma.ingredientAlias.findMany({
        where: { alias: { in: unique } },
        select: { alias: true, ingredientId: true, kind: true, confidence: true },
      }),
    ]);

    for (const ingredient of byName) {
      matches.set(ingredient.normalizedName, {
        ingredientId: ingredient.id,
        confidence: MATCH_CONFIDENCE.INCI_NAME,
        level: 'INCI_NAME',
      });
    }
    for (const alias of byAlias) {
      if (matches.has(alias.alias)) {
        continue;
      }
      const level: MatchLevel =
        alias.kind === 'CI_NUMBER' || isCiNumber(alias.alias) ? 'CI_NUMBER' : 'ALIAS';
      matches.set(alias.alias, {
        ingredientId: alias.ingredientId,
        confidence: Math.min(MATCH_CONFIDENCE[level], alias.confidence),
        level,
      });
    }
    return matches;
  }

  async matchOne(normalized: string): Promise<IngredientMatch | null> {
    const matches = await this.matchMany([normalized]);
    return matches.get(normalized) ?? null;
  }

  /**
   * Level 4: trigram similarity. A suggestion for the admin queue, never an
   * automatic match — typos like "Nicotinamide" get proposed, not written.
   */
  async suggest(normalized: string): Promise<IngredientSuggestion | null> {
    if (!normalized) {
      return null;
    }
    const rows = await this.prisma.$queryRaw<Array<{ id: string; score: number }>>(Prisma.sql`
      SELECT "id", similarity("normalizedName", ${normalized})::float8 AS score
      FROM "ingredients"
      WHERE "normalizedName" % ${normalized}
      ORDER BY score DESC
      LIMIT 1
    `);
    const best = rows[0];
    if (!best || best.score < SUGGESTION_MIN_SIMILARITY) {
      return null;
    }
    return { ingredientId: best.id, score: Number(best.score.toFixed(3)) };
  }
}
