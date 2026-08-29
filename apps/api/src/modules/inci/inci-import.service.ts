import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { LabelImportResultDto } from '@kosvia/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { computeIngredientScore } from '../scoring/ingredient-score';
import { positionWeight } from '../scoring/types';
import { PRODUCT_INCLUDE } from '../products/product.select';
import { toScorable } from '../products/product.mapper';
import { InciMatcherService, type IngredientMatch } from './inci-matcher.service';
import { parseLabel, type ParsedToken } from './inci-parser';
import { UnmatchedTokenService } from './unmatched-token.service';

const MAY_CONTAIN_WEIGHT = 0.1;
const RECOGNIZED_THRESHOLD = 0.9;

type ProductIngredientRowInput = Omit<Prisma.ProductIngredientCreateManyInput, 'productId'>;

interface ResolvedToken {
  token: ParsedToken;
  rows: ProductIngredientRowInput[];
  unmatchedNormalized: string[];
}

/**
 * Stages 6–7 of the pipeline: write what the label says, mark what we could
 * not resolve, and never fail the import because of an unknown token.
 */
@Injectable()
export class InciImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matcher: InciMatcherService,
    private readonly unmatchedTokens: UnmatchedTokenService,
  ) {}

  async applyLabel(productId: string, rawLabel: string): Promise<LabelImportResultDto> {
    if (!(await this.prisma.product.count({ where: { id: productId } }))) {
      throw new NotFoundException('That product does not exist.');
    }

    const parsed = parseLabel(rawLabel);
    const lookups = parsed.tokens.flatMap((token) => token.fragments);
    const matches = await this.matcher.matchMany(lookups);
    const resolved = parsed.tokens.map((token) => this.resolveToken(token, matches));

    const rows = this.renumber(resolved.flatMap((entry) => entry.rows));
    await this.prisma.$transaction([
      this.prisma.productIngredient.deleteMany({ where: { productId } }),
      this.prisma.productIngredient.createMany({
        data: rows.map((row) => ({ ...row, productId })),
      }),
    ]);

    await Promise.all(
      resolved.flatMap((entry) =>
        entry.unmatchedNormalized.map(async (normalized) => {
          const suggestion = await this.matcher.suggest(normalized);
          await this.unmatchedTokens.record(normalized, entry.token.rawText, suggestion);
        }),
      ),
    );
    await this.recomputeScore(productId);

    const unmatched = resolved
      .filter((entry) => entry.unmatchedNormalized.length)
      .map((entry) => entry.token.rawText);
    return {
      total: rows.length,
      matched: rows.filter((row) => row.ingredientId).length,
      unmatched,
      recognizedRatio: this.recognizedRatio(rows),
      hasMayContainSection: parsed.hasMayContainSection,
    };
  }

  private resolveToken(token: ParsedToken, matches: Map<string, IngredientMatch>): ResolvedToken {
    const base = { rawText: token.rawText, isAfterMayContain: token.isAfterMayContain };
    const fragmentMatches = token.fragments.map((fragment) => matches.get(fragment) ?? null);
    const distinctIngredientIds = new Set(
      fragmentMatches.flatMap((match) => (match ? [match.ingredientId] : [])),
    );

    if (distinctIngredientIds.size === 1) {
      const best = fragmentMatches
        .filter((match): match is IngredientMatch => match !== null)
        .sort((a, b) => b.confidence - a.confidence)[0];
      return {
        token,
        rows: [
          {
            ...base,
            ingredientId: best.ingredientId,
            matchConfidence: best.confidence,
            position: 0,
          },
        ],
        unmatchedNormalized: [],
      };
    }

    if (distinctIngredientIds.size === 0) {
      return {
        token,
        rows: [{ ...base, ingredientId: null, matchConfidence: 0, position: 0 }],
        unmatchedNormalized: [token.normalized],
      };
    }

    const rows = token.fragments.map((fragment, index) => {
      const match = fragmentMatches[index];
      return {
        ...base,
        rawText: fragment,
        ingredientId: match?.ingredientId ?? null,
        matchConfidence: match?.confidence ?? 0,
        position: 0,
      };
    });
    return {
      token,
      rows,
      unmatchedNormalized: token.fragments.filter((_, index) => !fragmentMatches[index]),
    };
  }

  private renumber(rows: ProductIngredientRowInput[]): ProductIngredientRowInput[] {
    return rows.map((row, index) => ({ ...row, position: index + 1 }));
  }

  private recognizedRatio(rows: ProductIngredientRowInput[]): number {
    let weighted = 0;
    let total = 0;
    for (const row of rows) {
      const weight =
        positionWeight(row.position) * (row.isAfterMayContain ? MAY_CONTAIN_WEIGHT : 1);
      total += weight;
      if ((row.matchConfidence ?? 0) >= RECOGNIZED_THRESHOLD) {
        weighted += weight;
      }
    }
    return total === 0 ? 0 : Number((weighted / total).toFixed(3));
  }

  async recomputeScore(productId: string): Promise<void> {
    const row = await this.prisma.product.findUnique({
      where: { id: productId },
      include: PRODUCT_INCLUDE,
    });
    if (!row) {
      return;
    }
    const { score } = computeIngredientScore(toScorable(row).ingredients);
    if (score !== row.ingredientScore) {
      await this.prisma.product.update({
        where: { id: productId },
        data: { ingredientScore: score },
      });
    }
  }
}
