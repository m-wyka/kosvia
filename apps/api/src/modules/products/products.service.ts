import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  IngredientScoreBreakdownDto,
  PersonalMatchDto,
  ProductDto,
  ProductFacetsDto,
  ProductSearchResult,
  ProductSummaryDto,
} from '@kosvia/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PersonalMatchService } from '../scoring/personal-match.service';
import { IngredientScoreService } from '../scoring/ingredient-score.service';
import type { ViewerContext } from '../profile/viewer-context.service';
import { PRODUCT_INCLUDE, type ProductRow } from './product.select';
import { decimalToNumber, toProductDto, toProductSummary, toScorable } from './product.mapper';
import type { ProductQueryDto } from './dto/product-query.dto';

const DEFAULT_PAGE_SIZE = 24;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly match: PersonalMatchService,
    private readonly ingredientScore: IngredientScoreService,
  ) {}

  /* ------------------------------------------------------------- reading -- */

  async search(query: ProductQueryDto, viewer: ViewerContext): Promise<ProductSearchResult> {
    const where = await this.buildWhere(query);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;

    // "best-match" and "recommended" depend on the per-user score, which the
    // database does not know about, so those sorts are applied after scoring.
    const needsClientSort = query.sort === 'best-match' || query.sort === 'recommended';
    const dbSort = this.orderBy(query.sort);

    const [total, rows] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: PRODUCT_INCLUDE,
        orderBy: dbSort,
        // Client-side sorting needs a wider window than one page, but stays
        // bounded so a huge catalogue never turns into a full table scan.
        ...(needsClientSort
          ? { take: Math.min(240, page * pageSize + pageSize * 4) }
          : { skip: (page - 1) * pageSize, take: pageSize }),
      }),
    ]);

    let items = this.decorate(rows, viewer);

    if (needsClientSort) {
      items = items.sort((a, b) => {
        const byScore = (b.personalMatch?.score ?? 0) - (a.personalMatch?.score ?? 0);
        if (byScore !== 0) return byScore;
        return b.ingredientScore - a.ingredientScore;
      });
      items = items.slice((page - 1) * pageSize, page * pageSize);
    }

    return {
      items,
      total,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
      facets: await this.facets(where),
    };
  }

  async findBySlug(slug: string, viewer: ViewerContext): Promise<ProductDto> {
    const row = await this.prisma.product.findUnique({ where: { slug }, include: PRODUCT_INCLUDE });
    if (!row || !row.isActive) throw new NotFoundException('We could not find that product.');
    return toProductDto(row, this.scoreOne(row, viewer));
  }

  async findByIdOrSlug(idOrSlug: string, viewer: ViewerContext): Promise<ProductDto> {
    const row = await this.prisma.product.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      include: PRODUCT_INCLUDE,
    });
    if (!row) throw new NotFoundException('We could not find that product.');
    return toProductDto(row, this.scoreOne(row, viewer));
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

  private async buildWhere(query: ProductQueryDto): Promise<Prisma.ProductWhereInput> {
    const and: Prisma.ProductWhereInput[] = [{ isActive: true }];

    if (query.q) {
      const term = query.q;
      and.push({
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { brand: { name: { contains: term, mode: 'insensitive' } } },
          { category: { name: { contains: term, mode: 'insensitive' } } },
          { ean: term },
          {
            ingredients: {
              some: { ingredient: { inciName: { contains: term, mode: 'insensitive' } } },
            },
          },
        ],
      });
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
    const root = await this.prisma.category.findFirst({
      where: { OR: [{ slug: slugOrId }, { id: slugOrId }] },
      select: { id: true },
    });
    if (!root) return [];

    const ids = [root.id];
    let frontier = [root.id];
    // Category trees are three levels deep by design; this loop is bounded.
    while (frontier.length) {
      const children = await this.prisma.category.findMany({
        where: { parentId: { in: frontier } },
        select: { id: true },
      });
      frontier = children.map((child) => child.id);
      ids.push(...frontier);
    }
    return ids;
  }

  private async facets(where: Prisma.ProductWhereInput): Promise<ProductFacetsDto> {
    const [byBrand, byCategory, priceAgg] = await Promise.all([
      this.prisma.product.groupBy({ by: ['brandId'], where, _count: { _all: true } }),
      this.prisma.product.groupBy({ by: ['categoryId'], where, _count: { _all: true } }),
      this.prisma.product.aggregate({
        where,
        _min: { lowestPrice: true },
        _max: { lowestPrice: true },
      }),
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
    };
  }
}
