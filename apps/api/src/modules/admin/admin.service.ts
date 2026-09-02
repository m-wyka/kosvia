import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type AppReviewStatus } from '@prisma/client';
import { pricePerHundred, slugify } from '@kosvia/shared';
import type { AdminStatsDto, AuditLogDto, PaginatedResult } from '@kosvia/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProductTraitsService } from '../scoring/product-traits.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { PRODUCT_INCLUDE } from '../products/product.select';
import { decimalToNumber, toProductDto } from '../products/product.mapper';
import { toVolumeUnitEnum, toVolumeUnitDto } from '../products/volume-unit';
import { normalizeToken } from '../inci/inci-parser';
import { MANUAL_SOURCE_CODE } from '../import/data-sources';
import type {
  AdminAppReviewQueryDto,
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly traits: ProductTraitsService,
    private readonly subscriptions: SubscriptionService,
  ) {}

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

  /* ---------------------------------------------------------------- audit -- */

  async listAudit(query: AdminListQueryDto): Promise<PaginatedResult<AuditLogDto>> {
    const where: Prisma.AuditLogWhereInput = query.q
      ? {
          OR: [
            { action: { contains: query.q, mode: 'insensitive' } },
            { entityId: { contains: query.q } },
            { actorId: { contains: query.q } },
          ],
        }
      : {};
    const page = await this.paginate(
      query,
      () => this.prisma.auditLog.count({ where }),
      (skip, take) =>
        this.prisma.auditLog.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    );
    const actorIds = [...new Set(page.items.flatMap((row) => (row.actorId ? [row.actorId] : [])))];
    const actors = await this.prisma.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, email: true },
    });
    const emailById = new Map(actors.map((actor) => [actor.id, actor.email]));
    return {
      ...page,
      items: page.items.map((row) => ({
        id: row.id,
        actorId: row.actorId,
        actorEmail: row.actorId ? (emailById.get(row.actorId) ?? null) : null,
        action: row.action,
        entity: row.entity,
        entityId: row.entityId,
        diff: (row.diff as Record<string, unknown> | null) ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
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
        normalizedName: normalizeToken(dto.inciName),
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
        normalizedName: normalizeToken(dto.inciName),
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
            { variants: { some: { ean: query.q } } },
            { brand: { name: { contains: query.q, mode: 'insensitive' } } },
          ],
        }
      : {};
    const page = await this.paginate(
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
            variants: { select: { _count: { select: { offers: true } } } },
            _count: { select: { ingredients: true } },
          },
        }),
    );
    return {
      ...page,
      items: page.items.map(({ variants, ...product }) => ({
        ...product,
        _count: {
          ingredients: product._count.ingredients,
          offers: variants.reduce((sum, variant) => sum + variant._count.offers, 0),
        },
      })),
    };
  }

  /** The public DTO (default pack flattened, packs listed) plus the flags only admins edit. */
  async productDetail(id: string) {
    const row = await this.prisma.product.findUniqueOrThrow({
      where: { id },
      include: PRODUCT_INCLUDE,
    });
    return {
      ...toProductDto(row, null, 'en'),
      isActive: row.isActive,
      paoMonths: row.paoMonths,
      targetSkinTypes: row.targetSkinTypes,
    };
  }

  async createProduct(dto: UpsertProductDto) {
    const ingredients = dto.ingredients && (await this.resolveIngredientRows(dto.ingredients));
    const manualSource = await this.prisma.dataSource.findUnique({
      where: { code: MANUAL_SOURCE_CODE },
      select: { id: true },
    });
    const product = await this.prisma.product.create({
      data: {
        ...this.productScalars(dto),
        slug: dto.slug ?? slugify(dto.name),
        isManuallyEdited: true,
        sourceId: manualSource?.id ?? null,
        variants: { create: { ...this.variantScalars(dto), isDefault: true } },
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
      data: {
        ...this.productScalars(dto),
        ...(dto.slug && { slug: dto.slug }),
        isManuallyEdited: true,
      },
    });
    await this.upsertDefaultVariant(id, this.variantScalars(dto));

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
      ? { variant: { product: { name: { contains: query.q, mode: 'insensitive' } } } }
      : {};
    const page = await this.paginate(
      query,
      () => this.prisma.productOffer.count({ where }),
      (skip, take) =>
        this.prisma.productOffer.findMany({
          where,
          skip,
          take,
          orderBy: { updatedAt: 'desc' },
          include: {
            variant: {
              select: {
                id: true,
                ean: true,
                volume: true,
                volumeUnit: true,
                product: {
                  select: { id: true, name: true, slug: true, brand: { select: { name: true } } },
                },
              },
            },
            store: { select: { id: true, name: true } },
          },
        }),
    );
    return {
      ...page,
      items: page.items.map(({ variant, ...offer }) => ({
        ...offer,
        product: variant.product,
        variant: {
          id: variant.id,
          ean: variant.ean,
          volume: decimalToNumber(variant.volume),
          volumeUnit: toVolumeUnitDto(variant.volumeUnit),
        },
      })),
    };
  }

  async upsertOffer(dto: UpsertOfferDto) {
    const variant = await this.resolveOfferVariant(dto);
    const offer = await this.prisma.productOffer.upsert({
      where: { variantId_storeId: { variantId: variant.id, storeId: dto.storeId } },
      create: {
        variantId: variant.id,
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
        variantId: variant.id,
        storeId: dto.storeId,
        price: new Prisma.Decimal(dto.price),
        currency: dto.currency ?? 'PLN',
      },
    });
    await this.refreshLowestPrice(dto.productId);
    return offer;
  }

  async deleteOffer(id: string) {
    const offer = await this.prisma.productOffer.findUnique({
      where: { id },
      select: { variant: { select: { productId: true } } },
    });
    if (!offer) throw new NotFoundException('That offer does not exist.');
    await this.prisma.productOffer.delete({ where: { id } });
    await this.refreshLowestPrice(offer.variant.productId);
  }

  /* --------------------------------------------------------------- users -- */

  async listAppReviews(query: AdminAppReviewQueryDto) {
    const where: Prisma.AppReviewWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.q && {
        OR: [
          { body: { contains: query.q, mode: 'insensitive' } },
          { user: { email: { contains: query.q, mode: 'insensitive' } } },
          { user: { name: { contains: query.q, mode: 'insensitive' } } },
        ],
      }),
    };
    return this.paginate(
      query,
      () => this.prisma.appReview.count({ where }),
      (skip, take) =>
        this.prisma.appReview.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { email: true, name: true } } },
        }),
    );
  }

  async updateAppReviewStatus(id: string, status: AppReviewStatus) {
    await this.assertExists('appReview', id);
    return this.prisma.appReview.update({
      where: { id },
      data: { status },
      include: { user: { select: { email: true, name: true } } },
    });
  }

  async deleteAppReview(id: string) {
    await this.assertExists('appReview', id);
    await this.prisma.appReview.delete({ where: { id } });
  }

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
    const { subscriptionStatus, subscriptionPeriod, ...profileFields } = dto;
    const updated = await this.prisma.user.update({
      where: { id },
      data: { ...profileFields },
      select: { id: true, email: true, name: true, role: true, subscriptionStatus: true },
    });
    if (subscriptionStatus && subscriptionStatus !== updated.subscriptionStatus) {
      await this.subscriptions.applyAdminStatus(id, subscriptionStatus, subscriptionPeriod);
      return { ...updated, subscriptionStatus };
    }
    return updated;
  }

  async deleteUser(id: string, actingUserId: string) {
    if (id === actingUserId)
      throw new BadRequestException('You cannot delete your own account here.');
    await this.prisma.user.delete({ where: { id } });
  }

  /* ----------------------------------------------------- formula changes -- */

  listFormulaChanges(query: AdminListQueryDto) {
    const where: Prisma.ProductFormulaRevisionWhereInput = query.q
      ? { product: { name: { contains: query.q, mode: 'insensitive' } } }
      : {};
    return this.paginate(
      query,
      () => this.prisma.productFormulaRevision.count({ where }),
      (skip, take) =>
        this.prisma.productFormulaRevision.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            productId: true,
            compositionHash: true,
            createdAt: true,
            product: {
              select: { name: true, slug: true, brand: { select: { name: true } } },
            },
            source: { select: { code: true } },
          },
        }),
    );
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
        isManuallyEdited: true,
        concentrationRange: entry.concentrationRange ?? null,
      };
    });
  }

  private productScalars(dto: UpsertProductDto) {
    return {
      name: dto.name,
      brandId: dto.brandId,
      categoryId: dto.categoryId,
      description: dto.description ?? null,
      usage: dto.usage ?? null,
      ...(dto.highlights && { highlights: dto.highlights }),
      ...(dto.isFragranceFree !== undefined && { isFragranceFree: dto.isFragranceFree }),
      ...(dto.isVegan !== undefined && { isVegan: dto.isVegan }),
      ...(dto.isCrueltyFree !== undefined && { isCrueltyFree: dto.isCrueltyFree }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      ...(dto.paoMonths !== undefined && { paoMonths: dto.paoMonths }),
      ...(dto.targetSkinTypes && { targetSkinTypes: dto.targetSkinTypes }),
    };
  }

  /** The admin form edits the default pack; other packs come from imports and feeds. */
  private variantScalars(dto: UpsertProductDto) {
    return {
      ean: dto.ean || null,
      imageUrl: dto.imageUrl ?? null,
      volume: dto.volume ?? null,
      volumeUnit: toVolumeUnitEnum(dto.volumeUnit),
    };
  }

  private async upsertDefaultVariant(
    productId: string,
    data: ReturnType<AdminService['variantScalars']>,
  ): Promise<void> {
    const existing = await this.prisma.productVariant.findFirst({
      where: { productId, isDefault: true },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.productVariant.update({ where: { id: existing.id }, data });
      return;
    }
    await this.prisma.productVariant.create({ data: { ...data, productId, isDefault: true } });
  }

  private async resolveOfferVariant(
    dto: UpsertOfferDto,
  ): Promise<{ id: string; productId: string }> {
    const variant = dto.variantId
      ? await this.prisma.productVariant.findUnique({
          where: { id: dto.variantId },
          select: { id: true, productId: true },
        })
      : await this.prisma.productVariant.findFirst({
          where: { productId: dto.productId, isDefault: true },
          select: { id: true, productId: true },
        });
    if (!variant || variant.productId !== dto.productId) {
      throw new BadRequestException('That pack does not belong to the product.');
    }
    return variant;
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
    await this.traits.refresh(productIds);
  }

  private async refreshLowestPrice(productId: string): Promise<void> {
    const [cheapest, defaultVariant] = await Promise.all([
      this.prisma.productOffer.aggregate({
        where: { variant: { productId }, availability: { not: 'OUT_OF_STOCK' } },
        _min: { price: true },
      }),
      this.prisma.productVariant.findFirst({
        where: { productId, isDefault: true },
        select: {
          volume: true,
          volumeUnit: true,
          offers: {
            where: { availability: { not: 'OUT_OF_STOCK' } },
            orderBy: { price: 'asc' },
            take: 1,
            select: { price: true },
          },
        },
      }),
    ]);
    const unitPrice = defaultVariant
      ? pricePerHundred(
          decimalToNumber(defaultVariant.offers[0]?.price ?? null),
          decimalToNumber(defaultVariant.volume),
          toVolumeUnitDto(defaultVariant.volumeUnit),
        )
      : null;
    await this.prisma.product.update({
      where: { id: productId },
      data: {
        lowestPrice: cheapest._min.price ?? null,
        pricePerHundred: unitPrice === null ? null : new Prisma.Decimal(unitPrice),
      },
    });
  }

  private async assertExists(
    model: 'appReview' | 'brand' | 'category' | 'ingredient' | 'product' | 'store' | 'user',
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
