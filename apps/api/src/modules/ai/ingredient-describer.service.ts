import { readFile } from 'node:fs/promises';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { normalizeToken } from '../inci/inci-parser';
import {
  AI_PROVIDER,
  type AIProvider,
  type IngredientProse,
} from './providers/ai-provider.interface';

export interface DescribeOptions {
  /** How many entries to write in this run. */
  limit: number;
  /** Only ingredients that appear on at least one product label. */
  onlyInProducts: boolean;
  isDryRun: boolean;
  onProgress?: (progress: DescribeProgress) => void;
}

export interface DescribeProgress {
  processed: number;
  written: number;
  declined: number;
  total: number;
}

const CONCURRENCY = 3;

/**
 * Prose written outside the API — in a Claude Code session, by hand — keyed by
 * INCI name. `en` is optional: entries that already have English keep it.
 */
export type IngredientProseFile = Record<string, { pl: IngredientProse; en?: IngredientProse }>;

export interface ProseFileSummary {
  applied: number;
  unknown: string[];
}

const UNDESCRIBED_SELECT = {
  id: true,
  inciName: true,
  description: true,
  functions: true,
  commonName: true,
  concerns: true,
  chemicalDescription: true,
  isFragranceAllergen: true,
  isRestricted: true,
  cosIngFunctions: { select: { function: { select: { name: true } } } },
} satisfies Prisma.IngredientSelect;

type UndescribedRow = Prisma.IngredientGetPayload<{ select: typeof UNDESCRIBED_SELECT }>;

/**
 * Fills in the English and Polish prose (`description`, plain-language
 * `functions`, `commonName`, `concerns`) for dictionary entries missing either
 * language. Hand-written English is kept and only translated. The model only
 * rewrites the facts CosIng supplies; scoring inputs — tags, sensitivity,
 * actives — are never touched here.
 */
@Injectable()
export class IngredientDescriberService {
  private readonly logger = new Logger(IngredientDescriberService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_PROVIDER) private readonly provider: AIProvider,
  ) {}

  async describeMissing(options: DescribeOptions): Promise<DescribeProgress> {
    const where: Prisma.IngredientWhereInput = {
      OR: [{ description: null }, { descriptionPl: null }],
      isManuallyEdited: false,
      ...(options.onlyInProducts ? { products: { some: {} } } : {}),
    };
    const rows = await this.prisma.ingredient.findMany({
      where,
      select: UNDESCRIBED_SELECT,
      orderBy: [{ products: { _count: 'desc' } }, { inciName: 'asc' }],
      take: options.limit,
    });
    const progress: DescribeProgress = {
      processed: 0,
      written: 0,
      declined: 0,
      total: rows.length,
    };
    if (options.isDryRun) {
      this.logger.log(`DRY RUN — ${rows.length} ingredients would be described`);
      return progress;
    }

    for (let index = 0; index < rows.length; index += CONCURRENCY) {
      const batch = rows.slice(index, index + CONCURRENCY);
      const outcomes = await Promise.all(batch.map((row) => this.describeOne(row)));
      for (const isWritten of outcomes) {
        progress.processed += 1;
        progress[isWritten ? 'written' : 'declined'] += 1;
      }
      options.onProgress?.(progress);
    }
    return progress;
  }

  async applyProseFile(path: string): Promise<ProseFileSummary> {
    const entries = JSON.parse(await readFile(path, 'utf8')) as IngredientProseFile;
    return this.applyProse(entries);
  }

  async applyProse(entries: IngredientProseFile): Promise<ProseFileSummary> {
    const byNormalized = new Map(
      Object.entries(entries).map(([inciName, prose]) => [normalizeToken(inciName), prose]),
    );
    const rows = await this.prisma.ingredient.findMany({
      where: { normalizedName: { in: [...byNormalized.keys()] } },
      select: { id: true, normalizedName: true, description: true },
    });
    for (const row of rows) {
      const prose = byNormalized.get(row.normalizedName);
      if (!prose) {
        continue;
      }
      const shouldWriteEnglish = prose.en && row.description === null;
      await this.prisma.ingredient.update({
        where: { id: row.id },
        data: {
          ...(shouldWriteEnglish && prose.en
            ? {
                description: prose.en.description,
                functions: prose.en.functions,
                commonName: prose.en.commonName,
                concerns: prose.en.concerns,
                descriptionGeneratedAt: new Date(),
              }
            : {}),
          descriptionPl: prose.pl.description,
          functionsPl: prose.pl.functions,
          commonNamePl: prose.pl.commonName,
          concernsPl: prose.pl.concerns,
        },
      });
    }
    const found = new Set(rows.map((row) => row.normalizedName));
    const unknown = Object.keys(entries).filter((name) => !found.has(normalizeToken(name)));
    return { applied: rows.length, unknown };
  }

  private async describeOne(row: UndescribedRow): Promise<boolean> {
    const result = await this.provider.describeIngredient({
      inciName: row.inciName,
      chemicalDescription: row.chemicalDescription,
      cosIngFunctions: row.cosIngFunctions.map((link) => link.function.name),
      isFragranceAllergen: row.isFragranceAllergen,
      isRestricted: row.isRestricted,
      existing: row.description
        ? {
            description: row.description,
            functions: row.functions,
            commonName: row.commonName,
            concerns: row.concerns,
          }
        : null,
    });
    if (!result?.en.description || !result.pl.description) {
      return false;
    }
    const isEnglishKept = row.description !== null;
    await this.prisma.ingredient.update({
      where: { id: row.id },
      data: {
        ...(isEnglishKept
          ? {}
          : {
              description: result.en.description,
              functions: result.en.functions,
              commonName: result.en.commonName,
              concerns: result.en.concerns,
              descriptionGeneratedAt: new Date(),
            }),
        descriptionPl: result.pl.description,
        functionsPl: result.pl.functions,
        commonNamePl: result.pl.commonName,
        concernsPl: result.pl.concerns,
      },
    });
    return true;
  }
}
