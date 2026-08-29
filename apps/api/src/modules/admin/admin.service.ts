import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { slugify } from '@kosvia/shared';
import type { AdminStatsDto, PaginatedResult } from '@kosvia/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { computeIngredientScore } from '../scoring/ingredient-score';
import { PRODUCT_INCLUDE } from '../products/product.select';
import { toScorable } from '../products/product.mapper';
import type {
  AdminListQueryDto,
  ProductIngredientInputDto,
  UpdateUserDto,
  UpsertBrandDto,
  UpsertCategoryDto,
  UpsertIngredientDto,
  UpsertOfferDto,
  UpsertProductDto,
  UpsertStoreDto,
} from './dto/admin.dto';

/**
 * Admin write layer.
 *
 * Two invariants are enforced here rather than left to the caller:
 *  - a product's denormalised `ingredientScore` is recomputed whenever its
 *    ingredient list changes, so the catalogue never serves a stale score;
 *  - a product's denormalised `lowestPrice` is recomputed whenever an offer
 *    changes, so price sorting and budget filters stay correct.
 */
@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async stats(): Promise<AdminStatsDto> {
    const [
      users,
      products,
      brands,
      categories,
      ingredients,
      stores,
      offers,
      shelfItems,
      conversations,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.product.count(),
      this.prisma.brand.count(),
      this.prisma.category.count(),
      this.prisma.ingredient.count(),
      this.prisma.store.count(),
      this.prisma.productOffer.count(),
      this.prisma.userShelfItem.count(),
      this.prisma.aIConversation.count(),
    ]);
    return {
      users,
      products,
      brands,
      categories,
      ingredients,
      stores,
      offers,
      shelfItems,
      conversations,
    };
  }

  /* -------------------------------------------------------------- brands -- */

  async listBrands(query: AdminListQueryDto) {
    const where: Prisma.BrandWhereInput = query.q
      ? { name: { contains: query.q, mode: 'insensitive' } }
      : {};
    return this.paginate(
      query,
      () => this.prisma.brand.count({ where }),
      (skip, take) =>
        this.prisma.brand.findMany({
          where,
          skip,
          take,
          orderBy: { name: 'asc' },
          include: { _count: { select: { products: true } } },
        }),
    );
  }

  createBrand(dto: UpsertBrandDto) {
    return this.prisma.brand.create({ data: { ...dto, slug: dto.slug ?? slugify(dto.name) } });
  }

  async updateBrand(id: string, dto: UpsertBrandDto) {
    await this.assertExists('brand', id);
    return this.prisma.brand.update({ where: { id }, data: { ...dto } });
  }

  async deleteBrand(id: string) {
    const count = await this.prisma.product.count({ where: { brandId: id } });
    if (count)
      throw new BadRequestException(
        `This brand still has ${count} products. Move or delete them first.`,
      );
    await this.prisma.brand.delete({ where: { id } });
  }

  /* ---------------------------------------------------------- categories -- */

  listCategories() {
    return this.prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { products: true } },
        parent: { select: { id: true, name: true } },
      },
    });
  }

  createCategory(dto: UpsertCategoryDto) {
    return this.prisma.category.create({
      data: { ...dto, parentId: dto.parentId || null, slug: dto.slug ?? slugify(dto.name) },
    });
  }

  async updateCategory(id: string, dto: UpsertCategoryDto) {
    if (dto.parentId === id) throw new BadRequestException('A category cannot be its own parent.');
    await this.assertExists('category', id);
    return this.prisma.category.update({
      where: { id },
      data: { ...dto, parentId: dto.parentId === undefined ? undefined : dto.parentId || null },
    });
  }

  async deleteCategory(id: string) {
    const [products, children] = await Promise.all([
      this.prisma.product.count({ where: { categoryId: id } }),
      this.prisma.category.count({ where: { parentId: id } }),
    ]);
    if (products) throw new BadRequestException(`This category still holds ${products} products.`);
    if (children) throw new BadRequestException('Remove or move the subcategories first.');
    await this.prisma.category.delete({ where: { id } });
  }

  /* --------------------------------------------------------- ingredients -- */

  async listIngredients(query: AdminListQueryDto) {
    const where: Prisma.IngredientWhereInput = query.q
      ? {
          OR: [
            { inciName: { contains: query.q, mode: 'insensitive' } },
            { commonName: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {};
    return this.paginate(
      query,
      () => this.prisma.ingredient.count({ where }),
      (skip, take) =>
        this.prisma.ingredient.findMany({
          where,
          skip,
          take,
          orderBy: { inciName: 'asc' },
          include: {
            targetsConcerns: { select: { slug: true, name: true } },
            supportsGoals: { select: { slug: true, name: true } },
            _count: { select: { products: true } },
          },
        }),
    );
  }

  async createIngredient(dto: UpsertIngredientDto) {
    const relations = await this.ingredientRelations(dto, 'connect');
    return this.prisma.ingredient.create({
      data: {
        inciName: dto.inciName,
        slug: slugify(dto.inciName),
        commonName: dto.commonName ?? null,
        description: dto.description ?? null,
        concerns: dto.concerns ?? null,
        functions: dto.functions ?? [],
        tags: dto.tags ?? [],
        comedogenicRating: dto.comedogenicRating ?? null,
        sensitivityImpact: dto.sensitivityImpact ?? 0,
        goodForSkinTypes: dto.goodForSkinTypes ?? [],
        isActiveIngredient: dto.isActiveIngredient ?? false,
        ...relations,
      },
    });
  }

  async updateIngredient(id: string, dto: UpsertIngredientDto) {
    await this.assertExists('ingredient', id);
    const relations = await this.ingredientRelations(dto, 'set');
    const updated = await this.prisma.ingredient.update({
      where: { id },
      data: {
        inciName: dto.inciName,
        commonName: dto.commonName ?? null,
        description: dto.description ?? null,
        concerns: dto.concerns ?? null,
        ...(dto.functions && { functions: dto.functions }),
        ...(dto.tags && { tags: dto.tags }),
        comedogenicRating: dto.comedogenicRating ?? null,
        ...(dto.sensitivityImpact !== undefined && { sensitivityImpact: dto.sensitivityImpact }),
        ...(dto.goodForSkinTypes && { goodForSkinTypes: dto.goodForSkinTypes }),
        ...(dto.isActiveIngredient !== undefined && { isActiveIngredient: dto.isActiveIngredient }),
        ...relations,
      },
    });
    // Every product containing this ingredient may now score differently.
    await this.recomputeScoresForIngredient(id);
    return updated;
  }

  async deleteIngredient(id: string) {
    const productIds = (
      await this.prisma.productIngredient.findMany({
        where: { ingredientId: id },
        select: { productId: true },
      })
    ).map((row) => row.productId);
    await this.prisma.ingredient.delete({ where: { id } });
    await this.recomputeScores(productIds);
  }

  /* ------------------------------------------------------------ products -- */

  async listProducts(query: AdminListQueryDto) {
    const where: Prisma.ProductWhereInput = query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: 'insensitive' } },
            { slug: { contains: query.q, mode: 'insensitive' } },
            { ean: query.q },
            { brand: { name: { contains: query.q, mode: 'insensitive' } } },
          ],
        }
      : {};
    return this.paginate(
      query,
      () => this.prisma.product.count({ where }),
      (skip, take) =>
        this.prisma.product.findMany({
          where,
          skip,
          take,
          orderBy: { updatedAt: 'desc' },
          include: {
            brand: { select: { id: true, name: true } },
            category: { select: { id: true, name: true } },
            _count: { select: { offers: true, ingredients: true } },
          },
        }),
    );
  }

  productDetail(id: string) {
    return this.prisma.product.findUniqueOrThrow({ where: { id }, include: PRODUCT_INCLUDE });
  }

  async createProduct(dto: UpsertProductDto) {
    const ingredients = dto.ingredients && (await this.resolveIngredientRows(dto.ingredients));
    const product = await this.prisma.product.create({
      data: {
        ...this.productScalars(dto),
        slug: dto.slug ?? slugify(dto.name),
        ...(ingredients && { ingredients: { create: ingredients } }),
      },
    });
    await this.recomputeScores([product.id]);
    return this.productDetail(product.id);
  }

  async updateProduct(id: string, dto: UpsertProductDto) {
    await this.assertExists('product', id);
    await this.prisma.product.update({
      where: { id },
      data: { ...this.productScalars(dto), ...(dto.slug && { slug: dto.slug }) },
    });

    if (dto.ingredients) {
      // Replacing the list wholesale keeps positions consistent — partial
      // edits would let two ingredients claim the same position.
      const ingredients = await this.resolveIngredientRows(dto.ingredients);
      await this.prisma.productIngredient.deleteMany({ where: { productId: id } });
      await this.prisma.productIngredient.createMany({
        data: ingredients.map((entry) => ({ ...entry, productId: id })),
      });
    }

    await this.recomputeScores([id]);
    return this.productDetail(id);
  }

  async deleteProduct(id: string) {
    await this.assertExists('product', id);
    await this.prisma.product.delete({ where: { id } });
  }

  /* -------------------------------------------------------------- stores -- */

  listStores() {
    return this.prisma.store.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { offers: true } } },
    });
  }

  createStore(dto: UpsertStoreDto) {
    return this.prisma.store.create({ data: { ...dto, slug: dto.slug ?? slugify(dto.name) } });
  }

  async updateStore(id: string, dto: UpsertStoreDto) {
    await this.assertExists('store', id);
    return this.prisma.store.update({ where: { id }, data: { ...dto } });
  }

  async deleteStore(id: string) {
    await this.prisma.store.delete({ where: { id } });
  }

  /* -------------------------------------------------------------- offers -- */

  async listOffers(query: AdminListQueryDto) {
    const where: Prisma.ProductOfferWhereInput = query.q
      ? { product: { name: { contains: query.q, mode: 'insensitive' } } }
      : {};
    return this.paginate(
      query,
      () => this.prisma.productOffer.count({ where }),
      (skip, take) =>
        this.prisma.productOffer.findMany({
          where,
          skip,
          take,
          orderBy: { updatedAt: 'desc' },
          include: {
            product: {
              select: { id: true, name: true, slug: true, brand: { select: { name: true } } },
            },
            store: { select: { id: true, name: true } },
          },
        }),
    );
  }

  async upsertOffer(dto: UpsertOfferDto) {
    const offer = await this.prisma.productOffer.upsert({
      where: { productId_storeId: { productId: dto.productId, storeId: dto.storeId } },
      create: {
        productId: dto.productId,
        storeId: dto.storeId,
        price: new Prisma.Decimal(dto.price),
        currency: dto.currency ?? 'PLN',
        url: dto.url ?? null,
        availability: dto.availability ?? 'IN_STOCK',
      },
      update: {
        price: new Prisma.Decimal(dto.price),
        ...(dto.currency && { currency: dto.currency }),
        url: dto.url ?? null,
        ...(dto.availability && { availability: dto.availability }),
        lastCheckedAt: new Date(),
      },
    });
    // Append to the price log, then refresh the denormalised lowest price.
    await this.prisma.priceHistory.create({
      data: {
        productId: dto.productId,
        storeId: dto.storeId,
        price: new Prisma.Decimal(dto.price),
        currency: dto.currency ?? 'PLN',
      },
    });
    await this.refreshLowestPrice(dto.productId);
    return offer;
  }

  async deleteOffer(id: string) {
    const offer = await this.prisma.productOffer.findUnique({ where: { id } });
    if (!offer) throw new NotFoundException('That offer does not exist.');
    await this.prisma.productOffer.delete({ where: { id } });
    await this.refreshLowestPrice(offer.productId);
  }

  /* --------------------------------------------------------------- users -- */

  async listUsers(query: AdminListQueryDto) {
    const where: Prisma.UserWhereInput = query.q
      ? {
          OR: [
            { email: { contains: query.q, mode: 'insensitive' } },
            { name: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {};
    return this.paginate(
      query,
      () => this.prisma.user.count({ where }),
      (skip, take) =>
        this.prisma.user.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            subscriptionStatus: true,
            createdAt: true,
            _count: { select: { shelfItems: true, priceAlerts: true, conversations: true } },
          },
        }),
    );
  }

  async updateUser(id: string, dto: UpdateUserDto, actingUserId: string) {
    if (id === actingUserId && dto.role && dto.role !== 'ADMIN') {
      throw new BadRequestException('You cannot remove your own admin access.');
    }
    await this.assertExists('user', id);
    return this.prisma.user.update({
      where: { id },
      data: { ...dto },
      select: { id: true, email: true, name: true, role: true, subscriptionStatus: true },
    });
  }

  async deleteUser(id: string, actingUserId: string) {
    if (id === actingUserId)
      throw new BadRequestException('You cannot delete your own account here.');
    await this.prisma.user.delete({ where: { id } });
  }

  /* ------------------------------------------------------------ internals -- */

  /**
   * Admin input references dictionary entries by id; the label text defaults
   * to the INCI name so every row satisfies the `rawText` invariant.
   */
  private async resolveIngredientRows(entries: ProductIngredientInputDto[]) {
    const ingredients = await this.prisma.ingredient.findMany({
      where: { id: { in: entries.map((entry) => entry.ingredientId) } },
      select: { id: true, inciName: true },
    });
    const inciNameById = new Map(ingredients.map((row) => [row.id, row.inciName]));
    return entries.map((entry) => {
      const inciName = inciNameById.get(entry.ingredientId);
      if (!inciName) {
        throw new BadRequestException(`Unknown ingredient "${entry.ingredientId}".`);
      }
      return {
        ingredientId: entry.ingredientId,
        rawText: entry.rawText ?? inciName,
        position: entry.position,
        concentrationRange: entry.concentrationRange ?? null,
      };
    });
  }

  private productScalars(dto: UpsertProductDto) {
    return {
      name: dto.name,
      brandId: dto.brandId,
      categoryId: dto.categoryId,
      ean: dto.ean || null,
      description: dto.description ?? null,
      usage: dto.usage ?? null,
      imageUrl: dto.imageUrl ?? null,
      volume: dto.volume ?? null,
      volumeUnit: dto.volumeUnit ?? 'ml',
      ...(dto.highlights && { highlights: dto.highlights }),
      ...(dto.isFragranceFree !== undefined && { isFragranceFree: dto.isFragranceFree }),
      ...(dto.isVegan !== undefined && { isVegan: dto.isVegan }),
      ...(dto.isCrueltyFree !== undefined && { isCrueltyFree: dto.isCrueltyFree }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      ...(dto.targetSkinTypes && { targetSkinTypes: dto.targetSkinTypes }),
    };
  }

  private async ingredientRelations(dto: UpsertIngredientDto, mode: 'set' | 'connect') {
    const [concerns, goals] = await Promise.all([
      dto.targetsConcernSlugs
        ? this.prisma.beautyConcern.findMany({
            where: { slug: { in: dto.targetsConcernSlugs } },
            select: { id: true },
          })
        : null,
      dto.supportsGoalSlugs
        ? this.prisma.beautyGoal.findMany({
            where: { slug: { in: dto.supportsGoalSlugs } },
            select: { id: true },
          })
        : null,
    ]);
    return {
      ...(concerns && { targetsConcerns: { [mode]: concerns.map((c) => ({ id: c.id })) } }),
      ...(goals && { supportsGoals: { [mode]: goals.map((g) => ({ id: g.id })) } }),
    };
  }

  private async recomputeScoresForIngredient(ingredientId: string): Promise<void> {
    const rows = await this.prisma.productIngredient.findMany({
      where: { ingredientId },
      select: { productId: true },
    });
    await this.recomputeScores(rows.map((row) => row.productId));
  }

  private async recomputeScores(productIds: string[]): Promise<void> {
    if (!productIds.length) return;
    const rows = await this.prisma.product.findMany({
      where: { id: { in: [...new Set(productIds)] } },
      include: PRODUCT_INCLUDE,
    });
    for (const row of rows) {
      const { score } = computeIngredientScore(toScorable(row).ingredients);
      if (score !== row.ingredientScore) {
        await this.prisma.product.update({
          where: { id: row.id },
          data: { ingredientScore: score },
        });
      }
    }
  }

  private async refreshLowestPrice(productId: string): Promise<void> {
    const cheapest = await this.prisma.productOffer.aggregate({
      where: { productId, availability: { not: 'OUT_OF_STOCK' } },
      _min: { price: true },
    });
    await this.prisma.product.update({
      where: { id: productId },
      data: { lowestPrice: cheapest._min.price ?? null },
    });
  }

  private async assertExists(
    model: 'brand' | 'category' | 'ingredient' | 'product' | 'store' | 'user',
    id: string,
  ): Promise<void> {
    const delegate = this.prisma[model] as unknown as {
      count: (args: { where: { id: string } }) => Promise<number>;
    };
    if (!(await delegate.count({ where: { id } }))) {
      throw new NotFoundException('That record does not exist.');
    }
  }

  private async paginate<T>(
    query: AdminListQueryDto,
    count: () => Promise<number>,
    fetch: (skip: number, take: number) => Promise<T[]>,
  ): Promise<PaginatedResult<T>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const [total, items] = await Promise.all([count(), fetch((page - 1) * pageSize, pageSize)]);
    return { items, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
  }
}
