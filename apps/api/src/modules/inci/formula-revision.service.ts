import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { FormulaChangeDto } from '@kosvia/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { normalizeToken } from './inci-parser';

const MATCH_CONFIDENCE_FOR_ID_KEY = 0.9;
const RECENT_FORMULA_CHANGE_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface FormulaRevisionRowInput {
  ingredientId?: string | null;
  rawText: string;
  isAfterMayContain?: boolean;
  matchConfidence?: number;
}

interface StoredCompositionRow {
  key: string;
  rawText: string;
  isAfterMayContain: boolean;
}

/**
 * A confidently matched row is identified by its ingredient id (stable across
 * matcher improvements to raw text); anything else falls back to the
 * normalised label text, so alias additions do not read as formula changes.
 */
export const revisionKey = (row: FormulaRevisionRowInput): string => {
  const isConfidentMatch =
    row.ingredientId && (row.matchConfidence ?? 1) >= MATCH_CONFIDENCE_FOR_ID_KEY;
  return isConfidentMatch ? `id:${row.ingredientId}` : `raw:${normalizeToken(row.rawText)}`;
};

export const compositionHash = (rows: FormulaRevisionRowInput[]): string => {
  const keys = rows.filter((row) => !row.isAfterMayContain).map(revisionKey);
  return createHash('sha256').update(keys.join('|')).digest('hex');
};

@Injectable()
export class FormulaRevisionService {
  constructor(private readonly prisma: PrismaService) {}

  async recordIfChanged(
    productId: string,
    rows: FormulaRevisionRowInput[],
    sourceId: string,
  ): Promise<void> {
    const hash = compositionHash(rows);
    const latest = await this.prisma.productFormulaRevision.findFirst({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      select: { compositionHash: true },
    });
    if (latest?.compositionHash === hash) {
      return;
    }
    const composition: StoredCompositionRow[] = rows.map((row) => ({
      key: revisionKey(row),
      rawText: row.rawText,
      isAfterMayContain: row.isAfterMayContain ?? false,
    }));
    await this.prisma.productFormulaRevision.create({
      data: {
        productId,
        compositionHash: hash,
        composition: composition as unknown as Prisma.InputJsonValue,
        sourceId,
      },
    });
  }

  async recentChange(productId: string): Promise<FormulaChangeDto | null> {
    const revisions = await this.prisma.productFormulaRevision.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      take: 2,
    });
    if (revisions.length < 2) {
      return null;
    }
    const [latest, previous] = revisions;
    const windowStart = new Date(Date.now() - RECENT_FORMULA_CHANGE_DAYS * DAY_MS);
    if (latest!.createdAt < windowStart) {
      return null;
    }

    const latestRows = this.mainListRows(latest!.composition);
    const previousRows = this.mainListRows(previous!.composition);
    const latestKeys = new Set(latestRows.map((row) => row.key));
    const previousKeys = new Set(previousRows.map((row) => row.key));

    const addedIngredients = latestRows
      .filter((row) => !previousKeys.has(row.key))
      .map((row) => row.rawText);
    const removedIngredients = previousRows
      .filter((row) => !latestKeys.has(row.key))
      .map((row) => row.rawText);
    const isReordered =
      !addedIngredients.length &&
      !removedIngredients.length &&
      latestRows.map((row) => row.key).join('|') !== previousRows.map((row) => row.key).join('|');

    return {
      changedAt: latest!.createdAt.toISOString(),
      addedIngredients,
      removedIngredients,
      isReordered,
    };
  }

  private mainListRows(composition: Prisma.JsonValue): StoredCompositionRow[] {
    const rows = (composition as unknown as StoredCompositionRow[]) ?? [];
    return rows.filter((row) => !row.isAfterMayContain);
  }
}
