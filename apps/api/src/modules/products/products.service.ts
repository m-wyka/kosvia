import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  IngredientScoreBreakdownDto,
  PersonalMatchDto,
  ProductDto,
  FormulaFacetsDto,
  ProductFacetsDto,
  ProductSearchResult,
  ProductSuggestionDto,
  ProductSummaryDto,
} from '@kosvia/shared';
import type { AnswerLocale } from '../../common/i18n/phrases';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PersonalMatchService } from '../scoring/personal-match.service';
import { IngredientScoreService } from '../scoring/ingredient-score.service';
import { CoarseMatchService } from '../scoring/coarse-match.service';
import type { ViewerContext } from '../profile/viewer-context.service';
import { PRODUCT_INCLUDE, type ProductRow } from './product.select';
import { decimalToNumber, toProductDto, toProductSummary, toScorable } from './product.mapper';
import type { ProductQueryDto } from './dto/product-query.dto';
import {
  SEARCH_PROVIDER,
  type RankedCandidate,
  type SearchProvider,
} from './search/search-provider';

const DEFAULT_PAGE_SIZE = 24;
/** Upper bound on ranked hits a text query can page through. */
const MAX_SEARCH_CANDIDATES = 500;
const SUGGESTION_LIMIT = 8;

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly match: PersonalMatchService,
    private readonly ingredientScore: IngredientScoreService,
    private readonly coarseMatch: CoarseMatchService,
    @Inject(SEARCH_PROVIDER) private readonly searchProvider: SearchProvider,
  ) {}

  /* ------------------------------------------------------------- reading -- */

  async search(query: ProductQueryDto, viewer: ViewerContext): Promise<ProductSearchResult> {
    const startedAt = Date.now();
    const candidates = query.q
      ? await this.searchProvider.rankedCandidates(query.q, MAX_SEARCH_CANDIDATES)
      : null;
    const where = await this.buildWhere(query, candidates, viewer);
    const sortsByPersonalMatch = query.sort === 'best-match' || query.sort === 'recommended';
    const result =
      candidates && this.sortsByRelevance(query.sort)
        ? await this.pageByRelevance(where, candidates, query, viewer)
        : sortsByPersonalMatch
          ? await this.pageByPersonalMatch(where, query, viewer)
          : await this.pageByColumn(where, query, viewer);

    if (query.q) {
      this.logSearch(query.q, result.total, Date.now() - startedAt);
    }
    return result;
  }

  suggest(query: string): Promise<ProductSuggestionDto[]> {
    return this.searchProvider.suggest(query, SUGGESTION_LIMIT);
  }

  /** With a text query and no explicit sort, the engine's ranking wins. */
  private sortsByRelevance(sort: ProductQueryDto['sort']): boolean {
    return sort === undefined;
  }

  private async pageByRelevance(
    where: Prisma.ProductWhereInput,
    candidates: RankedCandidate[],
    query: ProductQueryDto,
    viewer: ViewerContext,
  ): Promise<ProductSearchResult> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;

    const [matching, facets] = await Promise.all([
      this.prisma.product.findMany({ where, select: { id: true } }),
      this.facets(where),
    ]);
    const matchingIds = new Set(matching.map((row) => row.id));
    const ordered = candidates.filter((candidate) => matchingIds.has(candidate.id));
    const pageIds = ordered.slice((page - 1) * pageSize, page * pageSize).map((c) => c.id);

    const rows = await this.prisma.product.findMany({
      where: { id: { in: pageIds } },
      include: PRODUCT_INCLUDE,
    });
    const rowById = new Map(rows.map((row) => [row.id, row]));
    const pageRows = pageIds.flatMap((id) => rowById.get(id) ?? []);

    return {
      items: this.decorate(pageRows, viewer),
      total: ordered.length,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(ordered.length / pageSize)),
      facets,
    };
  }

  /**
   * Two-pass Personal Match (04_PERSONAL_MATCH.md §2): pass A ranks every
   * product that survives the filters with an SQL upper bound, pass B scores
   * only its top candidates exactly. Nothing that could reach the first page
   * is ever cut off by a formula-quality pre-sort.
   */
  private async pageByPersonalMatch(
    where: Prisma.ProductWhereInput,
    query: ProductQueryDto,
    viewer: ViewerContext,
  ): Promise<ProductSearchResult> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;

    const [matching, facets] = await Promise.all([
      this.prisma.product.findMany({ where, select: { id: true } }),
      this.facets(where),
    ]);
    const coarse = await this.coarseMatch.topCandidates(
      matching.map((row) => row.id),
      viewer.profile,
      viewer.shelf,
    );
    const rows = await this.prisma.product.findMany({
      where: { id: { in: coarse.map((candidate) => candidate.id) } },
      include: PRODUCT_INCLUDE,
    });

    const items = this.decorate(rows, viewer)
      .sort((a, b) => {
        const byScore = (b.personalMatch?.score ?? 0) - (a.personalMatch?.score ?? 0);
        if (byScore !== 0) return byScore;
        return b.ingredientScore - a.ingredientScore || a.name.localeCompare(b.name);
      })
      .slice((page - 1) * pageSize, page * pageSize);

    return {
      items,
      total: matching.length,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(coarse.length / pageSize)),
      facets,
    };
  }

  private async pageByColumn(
    where: Prisma.ProductWhereInput,
    query: ProductQueryDto,
    viewer: ViewerContext,
  ): Promise<ProductSearchResult> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;

    const [total, rows] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: PRODUCT_INCLUDE,
        orderBy: this.orderBy(query.sort),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const items = this.decorate(rows, viewer);

    return {
      items,
      total,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
      facets: await this.facets(where),
    };
  }

  async findBySlug(slug: string, viewer: ViewerContext, locale: AnswerLocale): Promise<ProductDto> {
    const row = await this.prisma.product.findUnique({ where: { slug }, include: PRODUCT_INCLUDE });
    if (!row || !row.isActive) throw new NotFoundException('We could not find that product.');
    return toProductDto(row, this.scoreOne(row, viewer), locale);
  }

  async findByIdOrSlug(
    idOrSlug: string,
    viewer: ViewerContext,
    locale: AnswerLocale,
  ): Promise<ProductDto> {
    const row = await this.prisma.product.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      include: PRODUCT_INCLUDE,
    });
    if (!row) throw new NotFoundException('We could not find that product.');
    return toProductDto(row, this.scoreOne(row, viewer), locale);
  }

  /** Used by comparison, alternatives and the AI retrieval layer. */
  async rowsByIdOrSlug(identifiers: string[]): Promise<ProductRow[]> {
    if (!identifiers.length) return [];
    return this.prisma.product.findMany({
      where: { OR: [{ id: { in: identifiers } }, { slug: { in: identifiers } }] },
      include: PRODUCT_INCLUDE,
    });
  }

  async ingredientBreakdown(slug: string): Promise<IngredientScoreBreakdownDto> {
    const row = await this.prisma.product.findUnique({ where: { slug }, include: PRODUCT_INCLUDE });
    if (!row) throw new NotFoundException('We could not find that product.');
    return this.ingredientScore.compute(toScorable(row).ingredients);
  }

  /* ---------------------------------------------------------- decorating -- */

  /** Attaches the per-viewer Personal Match to a batch of rows in one pass. */
  decorate(rows: ProductRow[], viewer: ViewerContext): ProductSummaryDto[] {
    const scores = this.match.scoreMany(rows.map(toScorable), viewer.profile, viewer.shelf);
    return rows.map((row) => toProductSummary(row, scores.get(row.id) ?? null));
  }

  scoreOne(row: ProductRow, viewer: ViewerContext): PersonalMatchDto {
    return this.match.score({
      product: toScorable(row),
      profile: viewer.profile,
      shelf: viewer.shelf,
    });
  }

  /* ------------------------------------------------------------ querying -- */

  private logSearch(query: string, resultCount: number, durationMs: number): void {
    this.prisma.searchLog
      .create({ data: { query, resultCount, durationMs } })
      .catch((error: unknown) => this.logger.warn(`Search log write failed: ${String(error)}`));
  }

  private async buildWhere(
    query: ProductQueryDto,
    candidates: RankedCandidate[] | null,
    viewer: ViewerContext,
  ): Promise<Prisma.ProductWhereInput> {
    const and: Prisma.ProductWhereInput[] = [{ isActive: true }];

    // A declared allergy is a hard filter, not a ranking signal: such products
    // must not be listed at all, and the totals must not count them.
    const allergens = viewer.profile?.allergenIngredientIds ?? [];
    if (allergens.length) {
      and.push({ ingredients: { none: { ingredientId: { in: allergens } } } });
    }

    if (candidates) {
      and.push({ id: { in: candidates.map((candidate) => candidate.id) } });
    }

    if (query.category) {
      // Category filters are inclusive of descendants, so /products?category=face
      // returns serums and moisturisers too.
      const ids = await this.categoryWithDescendants(query.category);
      if (!ids.length) throw new NotFoundException(`Unknown category "${query.category}".`);
      and.push({ categoryId: { in: ids } });
    }

    if (query.brand?.length) {
      and.push({ brand: { OR: [{ slug: { in: query.brand } }, { id: { in: query.brand } }] } });
    }

    if (query.ingredient?.length) {
      // Every listed ingredient must be present, not just one of them.
      for (const ingredient of query.ingredient) {
        and.push({
          ingredients: {
            some: { ingredient: { OR: [{ slug: ingredient }, { id: ingredient }] } },
          },
        });
      }
    }

    if (query.skinType) and.push({ targetSkinTypes: { has: query.skinType } });
    if (query.fragranceFree) and.push({ isFragranceFree: true });
    if (query.vegan) and.push({ isVegan: true });
    if (query.crueltyFree) and.push({ isCrueltyFree: true });
    if (query.spf) and.push({ traits: { hasSpf: true } });

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      if (
        query.minPrice !== undefined &&
        query.maxPrice !== undefined &&
        query.minPrice > query.maxPrice
      ) {
        throw new BadRequestException('The minimum price cannot be higher than the maximum price.');
      }
      and.push({
        lowestPrice: {
          ...(query.minPrice !== undefined && { gte: new Prisma.Decimal(query.minPrice) }),
          ...(query.maxPrice !== undefined && { lte: new Prisma.Decimal(query.maxPrice) }),
        },
      });
    }

    return { AND: and };
  }

  private orderBy(sort: ProductQueryDto['sort']): Prisma.ProductOrderByWithRelationInput[] {
    switch (sort) {
      case 'price-asc':
        return [{ lowestPrice: 'asc' }, { name: 'asc' }];
      case 'price-desc':
        return [{ lowestPrice: 'desc' }, { name: 'asc' }];
      case 'ingredient-score':
        return [{ ingredientScore: 'desc' }, { name: 'asc' }];
      case 'newest':
        return [{ createdAt: 'desc' }];
      default:
        return [{ ingredientScore: 'desc' }, { lowestPrice: 'asc' }, { name: 'asc' }];
    }
  }

  async categoryWithDescendants(slugOrId: string): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      WITH RECURSIVE tree AS (
        SELECT "id" FROM "categories" WHERE "slug" = ${slugOrId} OR "id" = ${slugOrId}
        UNION ALL
        SELECT c."id" FROM "categories" c JOIN tree ON c."parentId" = tree."id"
      )
      SELECT "id" FROM tree
    `);
    return rows.map((row) => row.id);
  }

  private async facets(where: Prisma.ProductWhereInput): Promise<ProductFacetsDto> {
    const [byBrand, byCategory, priceAgg, formula] = await Promise.all([
      this.prisma.product.groupBy({ by: ['brandId'], where, _count: { _all: true } }),
      this.prisma.product.groupBy({ by: ['categoryId'], where, _count: { _all: true } }),
      this.prisma.product.aggregate({
        where,
        _min: { lowestPrice: true },
        _max: { lowestPrice: true },
      }),
      this.formulaCounts(where),
    ]);

    const [brands, categories] = await Promise.all([
      this.prisma.brand.findMany({ where: { id: { in: byBrand.map((b) => b.brandId) } } }),
      this.prisma.category.findMany({ where: { id: { in: byCategory.map((c) => c.categoryId) } } }),
    ]);

    const brandCounts = new Map(byBrand.map((b) => [b.brandId, b._count._all]));
    const categoryCounts = new Map(byCategory.map((c) => [c.categoryId, c._count._all]));

    return {
      brands: brands
        .map((brand) => ({
          id: brand.id,
          name: brand.name,
          slug: brand.slug,
          logo: brand.logo,
          count: brandCounts.get(brand.id) ?? 0,
        }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
      categories: categories
        .map((category) => ({
          id: category.id,
          name: category.name,
          slug: category.slug,
          count: categoryCounts.get(category.id) ?? 0,
        }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
      priceRange: {
        min: decimalToNumber(priceAgg._min.lowestPrice) ?? 0,
        max: decimalToNumber(priceAgg._max.lowestPrice) ?? 0,
      },
      formula,
    };
  }

  /** One round-trip for every boolean facet, over the same filtered set. */
  private async formulaCounts(where: Prisma.ProductWhereInput): Promise<FormulaFacetsDto> {
    const [fragranceFree, vegan, crueltyFree, spf] = await Promise.all([
      this.prisma.product.count({ where: { AND: [where, { isFragranceFree: true }] } }),
      this.prisma.product.count({ where: { AND: [where, { isVegan: true }] } }),
      this.prisma.product.count({ where: { AND: [where, { isCrueltyFree: true }] } }),
      this.prisma.product.count({ where: { AND: [where, { traits: { hasSpf: true } }] } }),
    ]);
    return { fragranceFree, vegan, crueltyFree, spf };
  }
}
