import { Injectable, Logger } from '@nestjs/common';
import type { ImportRun, VolumeUnit } from '@prisma/client';
import { slugify } from '@kosvia/shared';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { InciImportService } from '../../inci/inci-import.service';
import { DATA_SOURCES, OPEN_BEAUTY_FACTS_SOURCE_CODE } from '../data-sources';
import { emptyCounters, ImportRunService, type ImportCounters } from '../import-run.service';
import { OBF_PAGE_SIZE, OpenBeautyFactsClient } from './obf-client';
import { mapObfProduct, type NormalizedProduct, type SkipReason } from './obf-mapper';

export interface ObfImportOptions {
  categoryTag: string;
  countryTag: string;
  limit: number;
  isDryRun: boolean;
  resume: boolean;
  /** Re-parse labels even when the source record has not changed — after a parser or dictionary update. */
  refresh?: boolean;
  onProgress?: (progress: ObfImportProgress) => void;
}

export interface ObfImportProgress {
  page: number;
  totalPages: number;
  processed: number;
  counters: ImportCounters;
  skipReasons: Record<string, number>;
}

export interface ObfImportSummary extends ObfImportProgress {
  runId: string;
  status: 'COMPLETED' | 'FAILED' | 'INTERRUPTED';
  errors: string[];
}

interface ObfCursor {
  categoryTag: string;
  countryTag: string;
  page: number;
  processed: number;
}

/** Below this position-weighted recognition share a product stays hidden until reviewed. */
const MIN_RECOGNIZED_RATIO_FOR_PUBLISHING = 0.8;

@Injectable()
export class OpenBeautyFactsImportService {
  private readonly logger = new Logger(OpenBeautyFactsImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: OpenBeautyFactsClient,
    private readonly inciImport: InciImportService,
    private readonly runs: ImportRunService,
  ) {}

  async run(options: ObfImportOptions): Promise<ObfImportSummary> {
    const source = await this.ensureSource();
    const resumable = options.resume ? await this.runs.findResumable(source.id) : null;
    const startCursor = this.cursorFrom(resumable, options);
    const run = await this.runs.start(
      source.id,
      { categoryTag: options.categoryTag, countryTag: options.countryTag, limit: options.limit },
      options.isDryRun,
    );

    const counters = emptyCounters();
    const errors: string[] = [];
    const skipReasons: Record<string, number> = {};
    let page = startCursor.page;
    let processed = startCursor.processed;
    let totalPages = page;

    const progress = (): ObfImportProgress => ({
      page,
      totalPages,
      processed,
      counters,
      skipReasons,
    });

    try {
      while (processed < options.limit) {
        const response = await this.client.searchPage({
          categoryTag: options.categoryTag,
          countryTag: options.countryTag,
          page,
        });
        totalPages = Math.max(1, Math.ceil(response.count / OBF_PAGE_SIZE));
        if (!response.products.length) {
          break;
        }

        for (const raw of response.products) {
          if (processed >= options.limit) {
            break;
          }
          processed += 1;
          const mapped = mapObfProduct(raw);
          if (mapped.kind === 'skip') {
            counters.skipped += 1;
            skipReasons[mapped.reason] = (skipReasons[mapped.reason] ?? 0) + 1;
            continue;
          }
          try {
            const outcome = await this.upsertProduct(
              mapped.product,
              source.id,
              options.isDryRun,
              options.refresh ?? false,
            );
            counters[outcome.change] += 1;
            if (outcome.queued) {
              counters.queued += 1;
            }
          } catch (error) {
            counters.failed += 1;
            errors.push(`${mapped.product.ean}: ${String(error)}`);
            this.logger.warn(`Failed ${mapped.product.ean}: ${String(error)}`);
          }
        }

        options.onProgress?.(progress());
        const cursor: ObfCursor = {
          categoryTag: options.categoryTag,
          countryTag: options.countryTag,
          page: page + 1,
          processed,
        };
        await this.runs.checkpoint(run.id, { ...cursor }, counters, errors);

        if (page >= totalPages) {
          break;
        }
        page += 1;
      }
      await this.runs.finish(run.id, 'COMPLETED', counters, errors);
      return { ...progress(), runId: run.id, status: 'COMPLETED', errors };
    } catch (error) {
      errors.push(`run aborted: ${String(error)}`);
      await this.runs.finish(run.id, 'FAILED', counters, errors);
      return { ...progress(), runId: run.id, status: 'FAILED', errors };
    }
  }

  /**
   * Imported products hidden for a poor recognition share get a second look
   * once the dictionary has grown. Returns how many were made visible.
   */
  async republishHidden(): Promise<number> {
    const hidden = await this.prisma.product.findMany({
      where: { isActive: false, isManuallyEdited: false, sourceId: { not: null } },
      select: {
        id: true,
        ingredients: {
          select: { position: true, isAfterMayContain: true, matchConfidence: true },
        },
      },
    });
    const publishable = hidden.filter(
      (product) =>
        this.inciImport.recognizedRatio(product.ingredients) >= MIN_RECOGNIZED_RATIO_FOR_PUBLISHING,
    );
    if (!publishable.length) {
      return 0;
    }
    await this.prisma.product.updateMany({
      where: { id: { in: publishable.map((product) => product.id) } },
      data: { isActive: true },
    });
    return publishable.length;
  }

  private cursorFrom(resumable: ImportRun | null, options: ObfImportOptions): ObfCursor {
    const cursor = resumable?.cursor as Partial<ObfCursor> | null | undefined;
    if (
      cursor &&
      cursor.categoryTag === options.categoryTag &&
      cursor.countryTag === options.countryTag &&
      typeof cursor.page === 'number'
    ) {
      this.logger.log(`Resuming run ${resumable?.id} from page ${cursor.page}`);
      return {
        categoryTag: options.categoryTag,
        countryTag: options.countryTag,
        page: cursor.page,
        processed: cursor.processed ?? 0,
      };
    }
    return {
      categoryTag: options.categoryTag,
      countryTag: options.countryTag,
      page: 1,
      processed: 0,
    };
  }

  private async ensureSource() {
    const definition = DATA_SOURCES.find((row) => row.code === OPEN_BEAUTY_FACTS_SOURCE_CODE);
    if (!definition) {
      throw new Error('Open Beauty Facts data source definition is missing.');
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

  private async upsertProduct(
    product: NormalizedProduct,
    sourceId: string,
    isDryRun: boolean,
    refresh: boolean,
  ): Promise<{ change: 'created' | 'updated' | 'skipped'; queued: boolean }> {
    const existing = await this.prisma.product.findFirst({
      where: {
        OR: [{ sourceId, sourceRef: product.ean }, { variants: { some: { ean: product.ean } } }],
      },
      select: { id: true, sourceId: true, sourceUpdatedAt: true, isManuallyEdited: true },
    });

    if (existing?.isManuallyEdited) {
      return { change: 'skipped', queued: false };
    }
    if (existing && existing.sourceId !== null && existing.sourceId !== sourceId) {
      return { change: 'skipped', queued: false };
    }
    const isUnchanged =
      !refresh &&
      existing?.sourceUpdatedAt &&
      product.sourceUpdatedAt &&
      existing.sourceUpdatedAt.getTime() >= product.sourceUpdatedAt.getTime();
    if (isUnchanged) {
      return { change: 'skipped', queued: false };
    }
    if (isDryRun) {
      return { change: existing ? 'updated' : 'created', queued: false };
    }

    const [brand, category] = await Promise.all([
      this.ensureBrand(product.brandName),
      this.prisma.category.findUniqueOrThrow({ where: { slug: product.categorySlug } }),
    ]);

    const data = {
      name: product.name,
      brandId: brand.id,
      categoryId: category.id,
      sourceId,
      sourceRef: product.ean,
      sourceUpdatedAt: product.sourceUpdatedAt,
    };
    const variant = {
      ean: product.ean,
      imageUrl: product.imageUrl,
      volume: product.volume,
      volumeUnit: product.volumeUnit,
      sourceRef: product.ean,
    };
    const row = existing
      ? await this.prisma.product.update({ where: { id: existing.id }, data })
      : await this.prisma.product.create({
          data: {
            ...data,
            slug: await this.uniqueSlug(product),
            variants: { create: { ...variant, isDefault: true } },
          },
        });
    if (existing) {
      await this.upsertVariant(existing.id, variant);
    }

    const label = await this.inciImport.applyLabel(row.id, product.rawLabel, { sourceId });
    const isPublishable = label.recognizedRatio >= MIN_RECOGNIZED_RATIO_FOR_PUBLISHING;
    await this.prisma.product.update({
      where: { id: row.id },
      data: { isActive: isPublishable },
    });
    return { change: existing ? 'updated' : 'created', queued: !isPublishable };
  }

  /** The barcode identifies the pack: an existing pack is refreshed, a new size joins the product. */
  private async upsertVariant(
    productId: string,
    variant: {
      ean: string;
      imageUrl: string | null;
      volume: number | null;
      volumeUnit: VolumeUnit;
      sourceRef: string;
    },
  ): Promise<void> {
    const existing = await this.prisma.productVariant.findUnique({
      where: { ean: variant.ean },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.productVariant.update({ where: { id: existing.id }, data: variant });
      return;
    }
    const hasDefault = await this.prisma.productVariant.count({
      where: { productId, isDefault: true },
    });
    await this.prisma.productVariant.create({
      data: { ...variant, productId, isDefault: hasDefault === 0 },
    });
  }

  private async ensureBrand(name: string) {
    const slug = slugify(name);
    return this.prisma.brand.upsert({
      where: { slug },
      create: { name, slug },
      update: {},
    });
  }

  private async uniqueSlug(product: NormalizedProduct): Promise<string> {
    const base = slugify(`${product.brandName} ${product.name}`);
    const taken = await this.prisma.product.count({ where: { slug: base } });
    return taken ? `${base}-${product.ean.slice(-4)}` : base;
  }
}

export type { SkipReason };
