import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { isCiNumber, joinHyphenatedToken, looseSeparatorKey } from './inci-parser';

export type MatchLevel = 'INCI_NAME' | 'ALIAS' | 'CI_NUMBER' | 'HYPHEN_REPAIR' | 'SEPARATOR_SHAPE';

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
  HYPHEN_REPAIR: 0.9,
  SEPARATOR_SHAPE: 0.9,
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

    await this.matchHyphenatedRemainder(unique, matches);
    await this.matchSeparatorShape(unique, matches);
    return matches;
  }

  /**
   * Level 3b: a token still unknown after the exact lookups may be a name the
   * scanner broke across a line. The joined form is accepted only when it is
   * itself a dictionary name, so a real dash-separated list never collapses
   * into one invented ingredient.
   */
  private async matchHyphenatedRemainder(
    tokens: string[],
    matches: Map<string, IngredientMatch>,
  ): Promise<void> {
    const joinedByToken = new Map<string, string>();
    for (const token of tokens) {
      if (matches.has(token)) {
        continue;
      }
      const joined = joinHyphenatedToken(token);
      if (joined) {
        joinedByToken.set(token, joined);
      }
    }
    if (!joinedByToken.size) {
      return;
    }

    const repaired = await this.prisma.ingredient.findMany({
      where: { normalizedName: { in: [...new Set(joinedByToken.values())] } },
      select: { id: true, normalizedName: true },
    });
    const idByName = new Map(repaired.map((row) => [row.normalizedName, row.id]));

    for (const [token, joined] of joinedByToken) {
      const ingredientId = idByName.get(joined);
      if (!ingredientId) {
        continue;
      }
      matches.set(token, {
        ingredientId,
        confidence: MATCH_CONFIDENCE.HYPHEN_REPAIR,
        level: 'HYPHEN_REPAIR',
      });
    }
  }

  /**
   * Level 3c: labels and the dictionary disagree about hyphens, slashes and
   * spaces — "coco glucoside" is "Coco-Glucoside", "coco caprylate caprate" is
   * "Coco-Caprylate/Caprate". Both sides are compared with those characters
   * removed. A key that more than one dictionary entry claims is left pending
   * rather than guessed at.
   */
  private async matchSeparatorShape(
    tokens: string[],
    matches: Map<string, IngredientMatch>,
  ): Promise<void> {
    const keyByToken = new Map<string, string>();
    for (const token of tokens) {
      if (matches.has(token)) {
        continue;
      }
      const key = looseSeparatorKey(token);
      if (key) {
        keyByToken.set(token, key);
      }
    }
    if (!keyByToken.size) {
      return;
    }

    const rows = await this.prisma.$queryRaw<Array<{ id: string; key: string }>>(Prisma.sql`
      SELECT "id", regexp_replace("normalizedName", '[- /]', '', 'g') AS key
      FROM "ingredients"
      WHERE regexp_replace("normalizedName", '[- /]', '', 'g')
            IN (${Prisma.join([...new Set(keyByToken.values())])})
    `);

    const idByKey = new Map<string, string | null>();
    for (const row of rows) {
      const seen = idByKey.get(row.key);
      if (seen === undefined) {
        idByKey.set(row.key, row.id);
        continue;
      }
      if (seen !== row.id) {
        idByKey.set(row.key, null);
      }
    }

    for (const [token, key] of keyByToken) {
      const ingredientId = idByKey.get(key);
      if (!ingredientId) {
        continue;
      }
      matches.set(token, {
        ingredientId,
        confidence: MATCH_CONFIDENCE.SEPARATOR_SHAPE,
        level: 'SEPARATOR_SHAPE',
      });
    }
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
