import { Injectable, Logger } from '@nestjs/common';
import type { ImportRun, Prisma, RegulatoryChangeKind } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { normalizeToken } from '../../inci/inci-parser';
import { COSING_SOURCE_CODE, DATA_SOURCES } from '../data-sources';
import { emptyCounters, ImportRunService, type ImportCounters } from '../import-run.service';
import { parseAnnexCsv } from './cosing-annex-parser';
import { COSING_PAGE_SIZE, CosIngClient } from './cosing-client';
import { functionCode, mapCosIngIngredient, type NormalizedIngredient } from './cosing-mapper';
import { COSING_ANNEXES, type CosIngAnnex, type CosIngAnnexEntry } from './cosing-types';

export interface CosIngImportOptions {
  isDryRun: boolean;
  resume: boolean;
  skipAnnexes: boolean;
  /** Stop after this many glossary pages — for smoke tests. */
  maxPages?: number;
  onProgress?: (progress: CosIngImportProgress) => void;
}

export type CosIngImportPhase = 'functions' | 'ingredients' | 'annexes';

export interface CosIngImportProgress {
  phase: CosIngImportPhase;
  page: number;
  totalPages: number;
  processed: number;
  counters: ImportCounters;
  skipReasons: Record<string, number>;
}

export interface CosIngImportSummary extends CosIngImportProgress {
  runId: string;
  status: 'COMPLETED' | 'FAILED';
  errors: string[];
}

interface CosIngCursor {
  phase: CosIngImportPhase;
  /** Index into the id ranges planned at the start of the glossary phase. */
  range: number;
  page: number;
  processed: number;
}

const FIRST_CURSOR: CosIngCursor = { phase: 'functions', range: 0, page: 1, processed: 0 };
const MAX_RESTRICTION_NOTE_LENGTH = 600;
const MAX_REGULATORY_FLIP_RATIO = 0.05;

type ExistingIngredient = Prisma.IngredientGetPayload<{
  select: {
    id: true;
    cosIngRef: true;
    normalizedName: true;
    slug: true;
    isManuallyEdited: true;
    tags: true;
  };
}>;

const EXISTING_SELECT = {
  id: true,
  cosIngRef: true,
  normalizedName: true,
  slug: true,
  isManuallyEdited: true,
  tags: true,
} satisfies Prisma.IngredientSelect;

@Injectable()
export class CosIngImportService {
  private readonly logger = new Logger(CosIngImportService.name);
  private functionIdByCode = new Map<string, string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: CosIngClient,
    private readonly runs: ImportRunService,
  ) {}

  async run(options: CosIngImportOptions): Promise<CosIngImportSummary> {
    const source = await this.ensureSource();
    const resumable = options.resume ? await this.runs.findResumable(source.id) : null;
    const cursor = this.cursorFrom(resumable);
    const run = await this.runs.start(
      source.id,
      { skipAnnexes: options.skipAnnexes, maxPages: options.maxPages ?? null },
      options.isDryRun,
    );

    const counters = emptyCounters();
    const errors: string[] = [];
    const skipReasons: Record<string, number> = {};
    let totalPages = 1;

    let pagesDone = 0;
    const progress = (): CosIngImportProgress => ({
      phase: cursor.phase,
      page: cursor.phase === 'ingredients' ? pagesDone : cursor.page,
      totalPages,
      processed: cursor.processed,
      counters,
      skipReasons,
    });
    const checkpoint = async () => {
      options.onProgress?.(progress());
      await this.runs.checkpoint(run.id, { ...cursor }, counters, errors);
    };

    try {
      if (cursor.phase === 'functions') {
        await this.importFunctions(options.isDryRun);
        cursor.phase = 'ingredients';
        cursor.page = 1;
        await checkpoint();
      } else {
        await this.loadFunctionIds();
      }

      if (cursor.phase === 'ingredients') {
        const ranges = await this.client.planIngredientRanges();
        totalPages = ranges.reduce(
          (sum, range) => sum + Math.ceil((range.totalResults ?? 0) / COSING_PAGE_SIZE),
          0,
        );
        let pagesLeft = options.maxPages ?? Infinity;
        while (cursor.range < ranges.length && pagesLeft > 0) {
          const range = ranges[cursor.range];
          const page = await this.client.fetchIngredientPage(range, cursor.page);
          pagesLeft -= 1;
          pagesDone += 1;
          if (!page.records.length) {
            cursor.range += 1;
            cursor.page = 1;
            continue;
          }
          const mapped = page.records.map(mapCosIngIngredient);
          const ingredients: NormalizedIngredient[] = [];
          for (const entry of mapped) {
            cursor.processed += 1;
            if (entry.kind === 'skip') {
              counters.skipped += 1;
              skipReasons[entry.reason] = (skipReasons[entry.reason] ?? 0) + 1;
            } else {
              ingredients.push(entry.ingredient);
            }
          }
          await this.upsertPage(
            ingredients,
            source.id,
            options.isDryRun,
            counters,
            skipReasons,
            errors,
          );
          const isLastPageOfRange = cursor.page * COSING_PAGE_SIZE >= page.totalResults;
          if (isLastPageOfRange) {
            cursor.range += 1;
            cursor.page = 1;
          } else {
            cursor.page += 1;
          }
          await checkpoint();
        }
        if (cursor.range >= ranges.length) {
          cursor.phase = 'annexes';
          cursor.range = 0;
          cursor.page = 1;
        }
      }

      if (cursor.phase === 'annexes' && !options.skipAnnexes) {
        totalPages = COSING_ANNEXES.length;
        const entries: CosIngAnnexEntry[] = [];
        for (const annex of COSING_ANNEXES) {
          cursor.page = COSING_ANNEXES.indexOf(annex) + 1;
          entries.push(...parseAnnexCsv(await this.client.fetchAnnexCsv(annex), annex));
        }
        const annexResult = await this.applyAnnexes(entries, options.isDryRun, run.id);
        counters.updated += annexResult.flagged;
        skipReasons['annex-name-not-in-glossary'] = annexResult.unmatchedNames.length;
        this.logger.log(
          `Annexes: ${annexResult.flagged} ingredients flagged, ${annexResult.unmatchedNames.length} annex names have no glossary entry`,
        );
        await checkpoint();
      }

      await this.runs.finish(run.id, 'COMPLETED', counters, errors);
      return { ...progress(), runId: run.id, status: 'COMPLETED', errors };
    } catch (error) {
      errors.push(`run aborted: ${String(error)}`);
      await this.runs.finish(run.id, 'FAILED', counters, errors);
      return { ...progress(), runId: run.id, status: 'FAILED', errors };
    }
  }

  private cursorFrom(resumable: ImportRun | null): CosIngCursor {
    const cursor = resumable?.cursor as Partial<CosIngCursor> | null | undefined;
    if (cursor?.phase && typeof cursor.page === 'number') {
      this.logger.log(`Resuming run ${resumable?.id} at ${cursor.phase} page ${cursor.page}`);
      return {
        phase: cursor.phase,
        range: cursor.range ?? 0,
        page: cursor.page,
        processed: cursor.processed ?? 0,
      };
    }
    return { ...FIRST_CURSOR };
  }

  private async ensureSource() {
    const definition = DATA_SOURCES.find((row) => row.code === COSING_SOURCE_CODE);
    if (!definition) {
      throw new Error('CosIng data source definition is missing.');
    }
    return this.prisma.dataSource.upsert({
      where: { code: definition.code },
      create: definition,
      update: {
        name: definition.name,
        license: definition.license,
        attribution: definition.attribution,
        url: definition.url,
      },
    });
  }

  private async importFunctions(isDryRun: boolean): Promise<void> {
    const functions = await this.client.fetchFunctions();
    if (isDryRun) {
      this.logger.log(`DRY RUN — ${functions.length} functions`);
      return;
    }
    for (const entry of functions) {
      const code = functionCode(entry.name);
      await this.prisma.ingredientFunction.upsert({
        where: { code },
        create: {
          code,
          name: entry.name,
          description: entry.description,
          cosIngRef: entry.cosIngRef,
        },
        update: { name: entry.name, description: entry.description, cosIngRef: entry.cosIngRef },
      });
    }
    await this.loadFunctionIds();
  }

  private async loadFunctionIds(): Promise<void> {
    const rows = await this.prisma.ingredientFunction.findMany({
      select: { id: true, code: true },
    });
    this.functionIdByCode = new Map(rows.map((row) => [row.code, row.id]));
  }

  private async upsertPage(
    ingredients: NormalizedIngredient[],
    sourceId: string,
    isDryRun: boolean,
    counters: ImportCounters,
    skipReasons: Record<string, number>,
    errors: string[],
  ): Promise<void> {
    if (!ingredients.length) {
      return;
    }
    const existing = await this.prisma.ingredient.findMany({
      where: {
        OR: [
          { cosIngRef: { in: ingredients.map((entry) => entry.cosIngRef) } },
          { normalizedName: { in: ingredients.map((entry) => entry.normalizedName) } },
        ],
      },
      select: EXISTING_SELECT,
    });
    const byRef = new Map(existing.flatMap((row) => (row.cosIngRef ? [[row.cosIngRef, row]] : [])));
    const byName = new Map(existing.map((row) => [row.normalizedName, row]));
    const takenSlugs = new Set(
      (
        await this.prisma.ingredient.findMany({
          where: { slug: { in: ingredients.map((entry) => entry.slug) } },
          select: { slug: true },
        })
      ).map((row) => row.slug),
    );
    const seenNames = new Set<string>();

    for (const ingredient of ingredients) {
      const match = byRef.get(ingredient.cosIngRef) ?? byName.get(ingredient.normalizedName);
      const isDuplicateName =
        (match && match.cosIngRef !== null && match.cosIngRef !== ingredient.cosIngRef) ||
        (!match && seenNames.has(ingredient.normalizedName));
      if (isDuplicateName) {
        counters.skipped += 1;
        skipReasons['duplicate-name'] = (skipReasons['duplicate-name'] ?? 0) + 1;
        continue;
      }
      seenNames.add(ingredient.normalizedName);
      if (isDryRun) {
        counters[match ? 'updated' : 'created'] += 1;
        continue;
      }
      try {
        if (match) {
          await this.updateExisting(match, ingredient);
          counters.updated += 1;
        } else {
          await this.createNew(ingredient, sourceId, takenSlugs);
          counters.created += 1;
        }
      } catch (error) {
        counters.failed += 1;
        errors.push(`${ingredient.inciName}: ${String(error)}`);
        this.logger.warn(`Failed ${ingredient.inciName}: ${String(error)}`);
      }
    }
  }

  private functionLinks(ingredient: NormalizedIngredient) {
    return ingredient.functionCodes.flatMap((code) => {
      const functionId = this.functionIdByCode.get(code);
      return functionId ? [{ functionId }] : [];
    });
  }

  /**
   * Hand-curated rows keep their prose, tags and scoring inputs; the import
   * only refreshes what CosIng is the authority on.
   */
  private async updateExisting(
    existing: ExistingIngredient,
    ingredient: NormalizedIngredient,
  ): Promise<void> {
    const shouldFillTags = !existing.isManuallyEdited && existing.tags.length === 0;
    await this.prisma.ingredient.update({
      where: { id: existing.id },
      data: {
        cosIngRef: ingredient.cosIngRef,
        casNumber: ingredient.casNumber,
        ecNumber: ingredient.ecNumber,
        innName: ingredient.innName,
        chemicalDescription: ingredient.chemicalDescription,
        ...(shouldFillTags ? { tags: ingredient.tags } : {}),
        cosIngFunctions: {
          deleteMany: {},
          create: this.functionLinks(ingredient),
        },
      },
    });
  }

  private async createNew(
    ingredient: NormalizedIngredient,
    sourceId: string,
    takenSlugs: Set<string>,
  ): Promise<void> {
    const slug = takenSlugs.has(ingredient.slug)
      ? `${ingredient.slug}-${ingredient.cosIngRef}`
      : ingredient.slug;
    takenSlugs.add(slug);
    await this.prisma.ingredient.create({
      data: {
        inciName: ingredient.inciName,
        normalizedName: ingredient.normalizedName,
        slug,
        cosIngRef: ingredient.cosIngRef,
        casNumber: ingredient.casNumber,
        ecNumber: ingredient.ecNumber,
        innName: ingredient.innName,
        chemicalDescription: ingredient.chemicalDescription,
        tags: ingredient.tags,
        sourceId,
        cosIngFunctions: { create: this.functionLinks(ingredient) },
      },
    });
  }

  /**
   * Annex flags are recomputed as a whole: cleared first, then set from the
   * current export, so a substance removed from an annex loses its flag.
   */
  private async applyAnnexes(
    entries: CosIngAnnexEntry[],
    isDryRun: boolean,
    importRunId: string,
  ): Promise<{ flagged: number; unmatchedNames: string[] }> {
    const nameToEntries = new Map<string, CosIngAnnexEntry[]>();
    for (const entry of entries) {
      for (const name of entry.names) {
        const normalized = normalizeToken(name);
        if (!normalized) {
          continue;
        }
        nameToEntries.set(normalized, [...(nameToEntries.get(normalized) ?? []), entry]);
      }
    }
    const rows = await this.prisma.ingredient.findMany({
      where: { normalizedName: { in: [...nameToEntries.keys()] } },
      select: {
        id: true,
        normalizedName: true,
        isProhibited: true,
        isRestricted: true,
        cosIngAnnex: true,
      },
    });
    const matchedNames = new Set(rows.map((row) => row.normalizedName));
    const unmatchedNames = [...nameToEntries.keys()].filter((name) => !matchedNames.has(name));
    if (isDryRun) {
      return { flagged: rows.length, unmatchedNames };
    }

    const changes: Prisma.RegulatoryChangeCreateManyInput[] = [];
    const record = (
      ingredientId: string,
      kind: RegulatoryChangeKind,
      previousAnnex: string | null,
      newAnnex: string | null,
    ) => {
      changes.push({ ingredientId, kind, previousAnnex, newAnnex, importRunId });
    };

    const flaggedOutsideAnnexes = await this.prisma.ingredient.findMany({
      where: {
        OR: [{ isProhibited: true }, { isRestricted: true }],
        id: { notIn: rows.map((row) => row.id) },
      },
      select: { id: true, isProhibited: true, isRestricted: true, cosIngAnnex: true },
    });
    for (const row of flaggedOutsideAnnexes) {
      if (row.isProhibited) {
        record(row.id, 'PROHIBITION_LIFTED', row.cosIngAnnex, null);
      } else {
        record(row.id, 'RESTRICTION_LIFTED', row.cosIngAnnex, null);
      }
    }

    await this.prisma.ingredient.updateMany({
      data: {
        isFragranceAllergen: false,
        isRestricted: false,
        isProhibited: false,
        cosIngAnnex: null,
        restrictionNote: null,
      },
    });
    for (const row of rows) {
      const rowEntries = nameToEntries.get(row.normalizedName) ?? [];
      const data = this.regulatoryData(rowEntries);
      if (!row.isProhibited && data.isProhibited) {
        record(row.id, 'BECAME_PROHIBITED', row.cosIngAnnex, 'II');
      } else if (!row.isRestricted && data.isRestricted && !data.isProhibited) {
        record(row.id, 'BECAME_RESTRICTED', row.cosIngAnnex, 'III');
      }
      if (row.isProhibited && !data.isProhibited) {
        record(row.id, 'PROHIBITION_LIFTED', row.cosIngAnnex, data.cosIngAnnex);
      }
      if (row.isRestricted && !data.isRestricted) {
        record(row.id, 'RESTRICTION_LIFTED', row.cosIngAnnex, data.cosIngAnnex);
      }
      await this.prisma.ingredient.update({
        where: { id: row.id },
        data,
      });
    }

    await this.recordRegulatoryChanges(changes);
    return { flagged: rows.length, unmatchedNames };
  }

  /**
   * A change wave touching a large share of the dictionary is almost certainly
   * a parser or normalisation regression, not a change in the law — better to
   * miss one real wave than to spam every shelf with false alerts.
   */
  private async recordRegulatoryChanges(
    changes: Prisma.RegulatoryChangeCreateManyInput[],
  ): Promise<void> {
    if (!changes.length) {
      return;
    }
    const dictionarySize = await this.prisma.ingredient.count();
    if (changes.length > dictionarySize * MAX_REGULATORY_FLIP_RATIO) {
      this.logger.warn(
        `Skipping ${changes.length} regulatory change events — more than ${MAX_REGULATORY_FLIP_RATIO * 100}% of the dictionary flipped in one run`,
      );
      return;
    }
    await this.prisma.regulatoryChange.createMany({ data: changes });
    this.logger.log(`Recorded ${changes.length} regulatory changes`);
  }

  private regulatoryData(entries: CosIngAnnexEntry[]): {
    isProhibited: boolean;
    isRestricted: boolean;
    isFragranceAllergen: boolean;
    cosIngAnnex: CosIngAnnex | null;
    restrictionNote: string | null;
  } {
    const annexes = new Set<CosIngAnnex>(entries.map((entry) => entry.annex));
    const primaryAnnex = COSING_ANNEXES.find((annex) => annexes.has(annex)) ?? null;
    const note = entries
      .filter((entry) => entry.annex !== 'II')
      .map((entry) => [entry.maximumConcentration, entry.conditions].filter(Boolean).join(' — '))
      .filter(Boolean)
      .join(' · ');
    return {
      isProhibited: annexes.has('II'),
      isRestricted: annexes.has('III'),
      isFragranceAllergen: entries.some((entry) => entry.isFragranceAllergen),
      cosIngAnnex: primaryAnnex,
      restrictionNote: note ? note.slice(0, MAX_RESTRICTION_NOTE_LENGTH) : null,
    };
  }
}
