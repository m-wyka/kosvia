import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { BrandDto, CategoryDto, IngredientDto, IngredientTag, StoreDto } from '@kosvia/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { normalizeToken } from '../inci/inci-parser';

const MAX_INGREDIENT_RESULTS = 200;

/** Read-only reference data: brands, the category tree, ingredients and stores. */
@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async brands(): Promise<BrandDto[]> {
    const brands = await this.prisma.brand.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    });
    return brands.map((brand) => ({
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      logo: brand.logo,
      description: brand.description,
      isVegan: brand.isVegan,
      isCrueltyFree: brand.isCrueltyFree,
      productCount: brand._count.products,
    }));
  }

  /** The full tree, nested. Small enough to build in memory. */
  async categories(): Promise<CategoryDto[]> {
    const rows = await this.prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true } } },
    });

    const nodes = new Map<string, CategoryDto>(
      rows.map((row) => [
        row.id,
        {
          id: row.id,
          name: row.name,
          slug: row.slug,
          parentId: row.parentId,
          description: row.description,
          productCount: row._count.products,
          children: [],
        },
      ]),
    );

    const roots: CategoryDto[] = [];
    for (const row of rows) {
      const node = nodes.get(row.id)!;
      if (row.parentId && nodes.has(row.parentId)) {
        nodes.get(row.parentId)!.children!.push(node);
      } else {
        roots.push(node);
      }
    }
    // Roll child counts up so "Skincare" reports everything beneath it.
    const rollUp = (node: CategoryDto): number => {
      const own = node.productCount ?? 0;
      const total = own + (node.children ?? []).reduce((sum, child) => sum + rollUp(child), 0);
      node.productCount = total;
      return total;
    };
    roots.forEach(rollUp);
    return roots;
  }

  async category(slug: string): Promise<CategoryDto> {
    const row = await this.prisma.category.findUnique({
      where: { slug },
      include: { children: true, _count: { select: { products: true } } },
    });
    if (!row) throw new NotFoundException('We could not find that category.');
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      parentId: row.parentId,
      description: row.description,
      productCount: row._count.products,
      children: row.children.map((child) => ({
        id: child.id,
        name: child.name,
        slug: child.slug,
        parentId: child.parentId,
        description: child.description,
      })),
    };
  }

  async ingredients(search?: string, tag?: string, take = 60): Promise<IngredientDto[]> {
    const limit = Math.min(take, MAX_INGREDIENT_RESULTS);
    const searchedIds = search ? await this.ingredientIdsMatching(search, limit) : null;
    const rows = await this.prisma.ingredient.findMany({
      where: {
        ...(searchedIds && { id: { in: searchedIds } }),
        ...(tag && { tags: { has: tag } }),
      },
      include: {
        targetsConcerns: { select: { slug: true } },
        supportsGoals: { select: { slug: true } },
      },
      orderBy: { inciName: 'asc' },
      take: limit,
    });
    if (!searchedIds) {
      return rows.map(toIngredientDto);
    }
    const rowById = new Map(rows.map((row) => [row.id, row]));
    return searchedIds.flatMap((id) => rowById.get(id) ?? []).map(toIngredientDto);
  }

  /** Prefix hits first (short queries), then trigram similarity for typos and mid-word matches. */
  private async ingredientIdsMatching(search: string, limit: number): Promise<string[]> {
    const term = normalizeToken(search);
    if (!term) {
      return [];
    }
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "ingredients"
      WHERE "normalizedName" LIKE ${`${term}%`}
         OR "normalizedName" % ${term}
         OR f_unaccent(lower(coalesce("commonName", ''))) % ${term}
      ORDER BY
        ("normalizedName" LIKE ${`${term}%`}) DESC,
        GREATEST(
          similarity("normalizedName", ${term}),
          similarity(f_unaccent(lower(coalesce("commonName", ''))), ${term})
        ) DESC,
        "inciName" ASC
      LIMIT ${limit}
    `);
    return rows.map((row) => row.id);
  }

  async ingredient(slug: string): Promise<IngredientDto> {
    const row = await this.prisma.ingredient.findUnique({
      where: { slug },
      include: {
        targetsConcerns: { select: { slug: true } },
        supportsGoals: { select: { slug: true } },
      },
    });
    if (!row) throw new NotFoundException('We could not find that ingredient.');
    return toIngredientDto(row);
  }

  async stores(): Promise<StoreDto[]> {
    const rows = await this.prisma.store.findMany({ orderBy: { name: 'asc' } });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      logo: row.logo,
      websiteUrl: row.websiteUrl,
    }));
  }
}

type IngredientRow = {
  id: string;
  inciName: string;
  slug: string;
  commonName: string | null;
  description: string | null;
  functions: string[];
  tags: string[];
  concerns: string | null;
  comedogenicRating: number | null;
  sensitivityImpact: number;
  goodForSkinTypes: IngredientDto['goodForSkinTypes'];
  isActiveIngredient: boolean;
  targetsConcerns: Array<{ slug: string }>;
  supportsGoals: Array<{ slug: string }>;
};

function toIngredientDto(row: IngredientRow): IngredientDto {
  return {
    id: row.id,
    inciName: row.inciName,
    slug: row.slug,
    commonName: row.commonName,
    description: row.description,
    functions: row.functions,
    tags: row.tags as IngredientTag[],
    concerns: row.concerns,
    comedogenicRating: row.comedogenicRating,
    sensitivityImpact: row.sensitivityImpact,
    goodForSkinTypes: row.goodForSkinTypes,
    targetsConcerns: row.targetsConcerns.map((c) => c.slug),
    supportsGoals: row.supportsGoals.map((g) => g.slug),
    isActiveIngredient: row.isActiveIngredient,
  };
}
