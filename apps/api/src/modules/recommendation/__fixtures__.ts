import { Prisma } from '@prisma/client';
import type { RoutineStep } from '@prisma/client';
import type { ProductRow } from '../products/product.select';

/**
 * Builds a Prisma-shaped product row without touching a database, so the
 * recommendation services can be tested as the pure ranking logic they are.
 */

interface RowOptions {
  id: string;
  name?: string;
  brandId?: string;
  brandName?: string;
  categoryId?: string;
  categorySlug?: string;
  routineStep?: RoutineStep;
  price?: number;
  volume?: number;
  ingredientScore?: number;
  isFragranceFree?: boolean;
  isVegan?: boolean;
  isCrueltyFree?: boolean;
  ingredientIds?: string[];
  targetSkinTypes?: ProductRow['targetSkinTypes'];
}

export function row(options: RowOptions): ProductRow {
  const {
    id,
    name = `Product ${id}`,
    brandId = `brand-${id}`,
    brandName = `Brand ${id}`,
    categoryId = 'cat-moisturizers',
    categorySlug = 'moisturizers',
    routineStep = 'MOISTURIZER',
    price = 50,
    volume = 50,
    ingredientScore = 60,
    isFragranceFree = true,
    isVegan = true,
    isCrueltyFree = true,
    ingredientIds = ['glycerin', 'aqua'],
    targetSkinTypes = [],
  } = options;

  const now = new Date('2026-01-01T00:00:00Z');

  return {
    id,
    ean: null,
    name,
    slug: id,
    brandId,
    categoryId,
    description: null,
    usage: null,
    imageUrl: null,
    volume,
    volumeUnit: 'ml',
    highlights: [],
    isFragranceFree,
    isVegan,
    isCrueltyFree,
    targetSkinTypes,
    ingredientScore,
    lowestPrice: new Prisma.Decimal(price),
    isActive: true,
    sourceId: null,
    sourceRef: null,
    sourceUpdatedAt: null,
    isManuallyEdited: false,
    createdAt: now,
    updatedAt: now,
    brand: {
      id: brandId,
      name: brandName,
      slug: brandId,
      logo: null,
      description: null,
      isVegan,
      isCrueltyFree,
    },
    category: {
      id: categoryId,
      name: 'Moisturizers',
      slug: categorySlug,
      description: null,
      parentId: null,
      routineStep,
      sortOrder: 0,
    },
    source: null,
    ingredients: ingredientIds.map((ingredientId, index) => ({
      id: `${id}-${ingredientId}`,
      productId: id,
      ingredientId,
      rawText: ingredientId,
      position: index + 1,
      isAfterMayContain: false,
      matchConfidence: 1,
      concentrationRange: null,
      sourceId: null,
      isManuallyEdited: false,
      ingredient: {
        id: ingredientId,
        inciName: ingredientId,
        normalizedName: ingredientId,
        sourceId: null,
        slug: ingredientId,
        commonName: null,
        description: null,
        functions: [],
        tags: ['humectant'],
        concerns: null,
        comedogenicRating: null,
        sensitivityImpact: 0,
        goodForSkinTypes: [],
        isActiveIngredient: false,
        cosIngRef: null,
        casNumber: null,
        ecNumber: null,
        innName: null,
        chemicalDescription: null,
        isFragranceAllergen: false,
        isRestricted: false,
        isProhibited: false,
        cosIngAnnex: null,
        restrictionNote: null,
        isManuallyEdited: false,
        descriptionGeneratedAt: null,
        commonNamePl: null,
        descriptionPl: null,
        functionsPl: [],
        concernsPl: null,
        targetsConcerns: [],
        supportsGoals: [],
        cosIngFunctions: [],
      },
    })),
    variants: [
      {
        id: `${id}-variant`,
        productId: id,
        ean: null,
        volume: volume === null ? null : new Prisma.Decimal(volume),
        volumeUnit: 'ML',
        imageUrl: null,
        isDefault: true,
        isActive: true,
        sourceRef: null,
        createdAt: now,
        updatedAt: now,
        offers: [
          {
            id: `${id}-offer`,
            productId: id,
            variantId: `${id}-variant`,
            storeId: 'store-1',
            price: new Prisma.Decimal(price),
            currency: 'PLN',
            url: null,
            availability: 'IN_STOCK',
            sourceId: null,
            lastCheckedAt: now,
            createdAt: now,
            updatedAt: now,
            store: {
              id: 'store-1',
              name: 'Demo Drogeria',
              slug: 'demo-drogeria',
              logo: null,
              websiteUrl: null,
              affiliateUrlTemplate: null,
            },
          },
        ],
      },
    ],
  } as ProductRow;
}
