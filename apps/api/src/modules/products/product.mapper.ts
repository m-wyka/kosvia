import { type Prisma } from '@prisma/client';
import { pricePerHundred } from '@kosvia/shared';
import type {
  CategoryDto,
  IngredientDto,
  IngredientTag,
  PersonalMatchDto,
  ProductDto,
  ProductOfferDto,
  ProductSummaryDto,
  StoreDto,
} from '@kosvia/shared';
import type { ScorableProduct } from '../scoring/types';
import type { ProductRow } from './product.select';

export function decimalToNumber(value: Prisma.Decimal | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'number' ? value : Number(value.toString());
}

export function toStoreDto(store: ProductRow['offers'][number]['store']): StoreDto {
  return {
    id: store.id,
    name: store.name,
    slug: store.slug,
    logo: store.logo,
    websiteUrl: store.websiteUrl,
  };
}

export function toCategoryDto(category: ProductRow['category']): CategoryDto {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    parentId: category.parentId,
    description: category.description,
  };
}

export function toIngredientDto(
  ingredient: ProductRow['ingredients'][number]['ingredient'],
): IngredientDto {
  return {
    id: ingredient.id,
    inciName: ingredient.inciName,
    slug: ingredient.slug,
    commonName: ingredient.commonName,
    description: ingredient.description,
    functions: ingredient.functions,
    tags: ingredient.tags as IngredientTag[],
    concerns: ingredient.concerns,
    comedogenicRating: ingredient.comedogenicRating,
    sensitivityImpact: ingredient.sensitivityImpact,
    goodForSkinTypes: ingredient.goodForSkinTypes,
    targetsConcerns: ingredient.targetsConcerns.map((c) => c.slug),
    supportsGoals: ingredient.supportsGoals.map((g) => g.slug),
    isActiveIngredient: ingredient.isActiveIngredient,
  };
}

export function toOfferDto(offer: ProductRow['offers'][number]): ProductOfferDto {
  return {
    id: offer.id,
    price: decimalToNumber(offer.price)!,
    currency: offer.currency,
    url: offer.url,
    availability: offer.availability,
    lastCheckedAt: offer.lastCheckedAt.toISOString(),
    store: toStoreDto(offer.store),
  };
}

/** Offers are ordered by price, so the first in-stock one is the best buy. */
function bestOffer(row: ProductRow): ProductRow['offers'][number] | null {
  return row.offers.find((offer) => offer.availability !== 'OUT_OF_STOCK') ?? row.offers[0] ?? null;
}

export function toProductSummary(
  row: ProductRow,
  personalMatch?: PersonalMatchDto | null,
): ProductSummaryDto {
  const offer = bestOffer(row);
  return {
    id: row.id,
    ean: row.ean,
    name: row.name,
    slug: row.slug,
    imageUrl: row.imageUrl,
    volume: row.volume,
    volumeUnit: row.volumeUnit,
    isFragranceFree: row.isFragranceFree,
    isVegan: row.isVegan,
    isCrueltyFree: row.isCrueltyFree,
    brand: { id: row.brand.id, name: row.brand.name, slug: row.brand.slug, logo: row.brand.logo },
    category: toCategoryDto(row.category),
    lowestPrice: offer ? decimalToNumber(offer.price) : decimalToNumber(row.lowestPrice),
    lowestPriceStore: offer ? toStoreDto(offer.store) : null,
    ingredientScore: row.ingredientScore,
    ...(personalMatch !== undefined ? { personalMatch } : {}),
  };
}

export function toProductDto(row: ProductRow, personalMatch?: PersonalMatchDto | null): ProductDto {
  const summary = toProductSummary(row, personalMatch);
  return {
    ...summary,
    description: row.description,
    usage: row.usage,
    highlights: row.highlights,
    ingredients: row.ingredients.map((entry) => ({
      position: entry.position,
      concentrationRange: entry.concentrationRange,
      ingredient: toIngredientDto(entry.ingredient),
    })),
    offers: row.offers.map(toOfferDto),
    pricePerHundredMl: pricePerHundred(summary.lowestPrice, row.volume, row.volumeUnit),
  };
}

/** Converts a database row into the plain shape the scoring engine consumes. */
export function toScorable(row: ProductRow): ScorableProduct {
  const offer = bestOffer(row);
  return {
    id: row.id,
    name: row.name,
    categoryId: row.categoryId,
    categorySlug: row.category.slug,
    brandId: row.brandId,
    isFragranceFree: row.isFragranceFree,
    isVegan: row.isVegan,
    isCrueltyFree: row.isCrueltyFree,
    targetSkinTypes: row.targetSkinTypes,
    ingredientScore: row.ingredientScore,
    lowestPrice: offer ? decimalToNumber(offer.price) : decimalToNumber(row.lowestPrice),
    ingredients: row.ingredients.map((entry) => ({
      position: entry.position,
      ingredient: {
        id: entry.ingredient.id,
        inciName: entry.ingredient.inciName,
        commonName: entry.ingredient.commonName,
        tags: entry.ingredient.tags,
        sensitivityImpact: entry.ingredient.sensitivityImpact,
        comedogenicRating: entry.ingredient.comedogenicRating,
        isActiveIngredient: entry.ingredient.isActiveIngredient,
        goodForSkinTypes: entry.ingredient.goodForSkinTypes,
        targetsConcerns: entry.ingredient.targetsConcerns.map((c) => c.slug),
        supportsGoals: entry.ingredient.supportsGoals.map((g) => g.slug),
      },
    })),
  };
}
