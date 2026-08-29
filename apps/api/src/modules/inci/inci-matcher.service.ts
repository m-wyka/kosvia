import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { isCiNumber } from './inci-parser';

export type MatchLevel = 'INCI_NAME' | 'ALIAS' | 'CI_NUMBER';

export interface IngredientMatch {
  ingredientId: string;
  confidence: number;
  level: MatchLevel;
}

export const MATCH_CONFIDENCE: Record<MatchLevel, number> = {
  INCI_NAME: 1,
  ALIAS: 0.95,
  CI_NUMBER: 0.95,
};

/**
 * Resolves normalised label tokens to dictionary entries. Trigram similarity
 * (the fourth level from the spec) needs pg_trgm and arrives with the search
 * work; until then a token either matches exactly or goes to the queue.
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
}
