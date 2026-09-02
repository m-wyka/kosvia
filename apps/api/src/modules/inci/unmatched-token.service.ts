import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AliasKind, TokenStatus, type Prisma } from '@prisma/client';
import type { BulkResolutionDto, PaginatedResult, UnmatchedTokenDto } from '@kosvia/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProductTraitsService } from '../scoring/product-traits.service';
import { normalizeToken } from './inci-parser';
import {
  InciMatcherService,
  MATCH_CONFIDENCE,
  type IngredientSuggestion,
} from './inci-matcher.service';

const MAX_RAW_SAMPLES = 5;
const DEFAULT_PAGE_SIZE = 25;

export interface UnmatchedTokenQuery {
  status?: TokenStatus;
  page?: number;
  pageSize?: number;
}

export interface ResolutionSummary {
  token: UnmatchedTokenDto;
  rematchedRows: number;
  affectedProducts: number;
}

export interface RematchSummary {
  resolvedTokens: number;
  rematchedRows: number;
  affectedProducts: number;
}

const TOKEN_SELECT = {
  id: true,
  normalized: true,
  rawSamples: true,
  occurrenceCount: true,
  suggestedIngredientId: true,
  suggestedScore: true,
  status: true,
  resolvedAt: true,
  createdAt: true,
  suggestedIngredient: { select: { id: true, inciName: true } },
} satisfies Prisma.UnmatchedTokenSelect;

type TokenRow = Prisma.UnmatchedTokenGetPayload<{ select: typeof TOKEN_SELECT }>;

@Injectable()
export class UnmatchedTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly traits: ProductTraitsService,
    private readonly matcher: InciMatcherService,
  ) {}

  async record(
    normalized: string,
    rawSample: string,
    suggestion: IngredientSuggestion | null = null,
  ): Promise<void> {
    const suggested = suggestion
      ? { suggestedIngredientId: suggestion.ingredientId, suggestedScore: suggestion.score }
      : {};
    const existing = await this.prisma.unmatchedToken.findUnique({
      where: { normalized },
      select: { id: true, rawSamples: true, status: true, suggestedScore: true },
    });
    if (!existing) {
      await this.prisma.unmatchedToken.create({
        data: { normalized, rawSamples: [rawSample], ...suggested },
      });
      return;
    }
    const rawSamples = existing.rawSamples.includes(rawSample)
      ? existing.rawSamples
      : [...existing.rawSamples, rawSample].slice(0, MAX_RAW_SAMPLES);
    const isBetterSuggestion =
      suggestion !== null && suggestion.score > (existing.suggestedScore ?? 0);
    await this.prisma.unmatchedToken.update({
      where: { id: existing.id },
      data: {
        rawSamples,
        occurrenceCount: { increment: 1 },
        ...(isBetterSuggestion ? suggested : {}),
        ...(existing.status === 'IGNORED' ? {} : { status: 'PENDING', resolvedAt: null }),
      },
    });
  }

  async list(query: UnmatchedTokenQuery): Promise<PaginatedResult<UnmatchedTokenDto>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const where: Prisma.UnmatchedTokenWhereInput = { status: query.status ?? 'PENDING' };
    const [total, rows] = await Promise.all([
      this.prisma.unmatchedToken.count({ where }),
      this.prisma.unmatchedToken.findMany({
        where,
        select: TOKEN_SELECT,
        orderBy: [{ occurrenceCount: 'desc' }, { createdAt: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      items: rows.map(toDto),
      total,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async mapToIngredient(
    tokenId: string,
    ingredientId: string,
    kind: AliasKind,
    status: Extract<TokenStatus, 'MAPPED' | 'NEW_INGREDIENT'> = 'MAPPED',
  ): Promise<ResolutionSummary> {
    const token = await this.requireToken(tokenId);
    const ingredient = await this.prisma.ingredient.findUnique({
      where: { id: ingredientId },
      select: { id: true, normalizedName: true },
    });
    if (!ingredient) {
      throw new NotFoundException('That ingredient does not exist.');
    }

    if (ingredient.normalizedName !== token.normalized) {
      const existingAlias = await this.prisma.ingredientAlias.findUnique({
        where: { alias: token.normalized },
        select: { ingredientId: true },
      });
      if (existingAlias && existingAlias.ingredientId !== ingredientId) {
        throw new BadRequestException('That label text is already an alias of another ingredient.');
      }
      if (!existingAlias) {
        await this.prisma.ingredientAlias.create({
          data: {
            ingredientId,
            alias: token.normalized,
            aliasRaw: token.rawSamples[0] ?? token.normalized,
            kind,
          },
        });
      }
    }

    const confidence =
      ingredient.normalizedName === token.normalized
        ? MATCH_CONFIDENCE.INCI_NAME
        : kind === 'CI_NUMBER'
          ? MATCH_CONFIDENCE.CI_NUMBER
          : MATCH_CONFIDENCE.ALIAS;
    const rematch = await this.rematchRows(token.normalized, ingredientId, confidence);

    const updated = await this.prisma.unmatchedToken.update({
      where: { id: token.id },
      data: { status, resolvedAt: new Date(), suggestedIngredientId: ingredientId },
      select: TOKEN_SELECT,
    });
    return { token: toDto(updated), ...rematch };
  }

  async ignore(tokenId: string): Promise<UnmatchedTokenDto> {
    await this.requireToken(tokenId);
    const updated = await this.prisma.unmatchedToken.update({
      where: { id: tokenId },
      data: { status: 'IGNORED', resolvedAt: new Date() },
      select: TOKEN_SELECT,
    });
    return toDto(updated);
  }

  async ignoreMany(tokenIds: string[]): Promise<BulkResolutionDto> {
    const { count } = await this.prisma.unmatchedToken.updateMany({
      where: { id: { in: tokenIds }, status: 'PENDING' },
      data: { status: 'IGNORED', resolvedAt: new Date() },
    });
    return { resolvedTokens: count, skippedTokens: tokenIds.length - count, rematchedRows: 0 };
  }

  /**
   * Accepts the trigram suggestion the queue already shows for each token.
   * A token without a suggestion is skipped rather than guessed at, and one
   * whose text is already an alias of a different ingredient is left for a
   * human — the same rule `mapToIngredient` enforces one at a time.
   */
  async acceptSuggestions(tokenIds: string[]): Promise<BulkResolutionDto> {
    const tokens = await this.prisma.unmatchedToken.findMany({
      where: { id: { in: tokenIds }, status: 'PENDING', suggestedIngredientId: { not: null } },
      select: { id: true, suggestedIngredientId: true },
    });

    let resolvedTokens = 0;
    let rematchedRows = 0;
    for (const token of tokens) {
      try {
        const summary = await this.mapToIngredient(
          token.id,
          token.suggestedIngredientId as string,
          'SYNONYM',
        );
        resolvedTokens += 1;
        rematchedRows += summary.rematchedRows;
      } catch {
        continue;
      }
    }
    return {
      resolvedTokens,
      skippedTokens: tokenIds.length - resolvedTokens,
      rematchedRows,
    };
  }

  async reopen(tokenId: string): Promise<UnmatchedTokenDto> {
    await this.requireToken(tokenId);
    const updated = await this.prisma.unmatchedToken.update({
      where: { id: tokenId },
      data: { status: 'PENDING', resolvedAt: null },
      select: TOKEN_SELECT,
    });
    return toDto(updated);
  }

  /**
   * After the dictionary grows (a CosIng import, a batch of aliases) every
   * pending token gets one more exact lookup; hits are resolved the same way
   * an admin would resolve them by hand.
   */
  async rematchPending(): Promise<RematchSummary> {
    const pending = await this.prisma.unmatchedToken.findMany({
      where: { status: 'PENDING' },
      select: { id: true, normalized: true },
    });
    const matches = await this.matcher.matchMany(pending.map((token) => token.normalized));
    const candidates = await this.prisma.productIngredient.findMany({
      where: { ingredientId: null },
      select: { id: true, productId: true, rawText: true },
    });
    const rowsByNormalized = new Map<string, typeof candidates>();
    for (const row of candidates) {
      const normalized = normalizeToken(row.rawText);
      rowsByNormalized.set(normalized, [...(rowsByNormalized.get(normalized) ?? []), row]);
    }

    const productIds = new Set<string>();
    let rematchedRows = 0;
    let resolvedTokens = 0;
    for (const token of pending) {
      const match = matches.get(token.normalized);
      if (!match) {
        continue;
      }
      const rows = rowsByNormalized.get(token.normalized) ?? [];
      if (rows.length) {
        await this.prisma.productIngredient.updateMany({
          where: { id: { in: rows.map((row) => row.id) } },
          data: { ingredientId: match.ingredientId, matchConfidence: match.confidence },
        });
        rows.forEach((row) => productIds.add(row.productId));
        rematchedRows += rows.length;
      }
      await this.prisma.unmatchedToken.update({
        where: { id: token.id },
        data: {
          status: 'MAPPED',
          resolvedAt: new Date(),
          suggestedIngredientId: match.ingredientId,
        },
      });
      resolvedTokens += 1;
    }
    if (productIds.size) {
      await this.traits.refresh([...productIds]);
    }
    return { resolvedTokens, rematchedRows, affectedProducts: productIds.size };
  }

  private async rematchRows(
    normalized: string,
    ingredientId: string,
    confidence: number,
  ): Promise<Pick<ResolutionSummary, 'rematchedRows' | 'affectedProducts'>> {
    const candidates = await this.prisma.productIngredient.findMany({
      where: { ingredientId: null },
      select: { id: true, productId: true, rawText: true },
    });
    const rows = candidates.filter((row) => normalizeToken(row.rawText) === normalized);
    if (!rows.length) {
      return { rematchedRows: 0, affectedProducts: 0 };
    }
    await this.prisma.productIngredient.updateMany({
      where: { id: { in: rows.map((row) => row.id) } },
      data: { ingredientId, matchConfidence: confidence },
    });
    const productIds = [...new Set(rows.map((row) => row.productId))];
    await this.traits.refresh(productIds);
    return { rematchedRows: rows.length, affectedProducts: productIds.length };
  }

  private async requireToken(id: string): Promise<TokenRow> {
    const token = await this.prisma.unmatchedToken.findUnique({
      where: { id },
      select: TOKEN_SELECT,
    });
    if (!token) {
      throw new NotFoundException('That token is not in the queue.');
    }
    return token;
  }
}

const toDto = (row: TokenRow): UnmatchedTokenDto => ({
  id: row.id,
  normalized: row.normalized,
  rawSamples: row.rawSamples,
  occurrenceCount: row.occurrenceCount,
  suggestedIngredient: row.suggestedIngredient,
  suggestedScore: row.suggestedScore,
  status: row.status,
  resolvedAt: row.resolvedAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
});
