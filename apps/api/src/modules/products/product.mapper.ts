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
  ProductVariantDto,
  StoreDto,
  VolumeUnit,
} from '@kosvia/shared';
import type { AnswerLocale } from '../../common/i18n/phrases';
import type { ScorableProduct } from '../scoring/types';
import {
  hasMatchedIngredient,
  type IngredientRow,
  type ProductOfferRow,
  type ProductRow,
  type ProductVariantRow,
} from './product.select';

export function decimalToNumber(value: Prisma.Decimal | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'number' ? value : Number(value.toString());
}

export function toStoreDto(store: ProductOfferRow['store']): StoreDto {
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

/** Polish prose when asked for and present; the English columns are the fallback. */
const localisedProse = (ingredient: IngredientRow, locale: AnswerLocale) => {
  const isPolish = locale === 'pl';
  return {
    commonName: (isPolish && ingredient.commonNamePl) || ingredient.commonName,
    description: (isPolish && ingredient.descriptionPl) || ingredient.description,
    functions:
      isPolish && ingredient.functionsPl.length ? ingredient.functionsPl : ingredient.functions,
    concerns: (isPolish && ingredient.concernsPl) || ingredient.concerns,
  };
};

export function toIngredientDto(ingredient: IngredientRow, locale: AnswerLocale): IngredientDto {
  const prose = localisedProse(ingredient, locale);
  return {
    id: ingredient.id,
    inciName: ingredient.inciName,
    slug: ingredient.slug,
    commonName: prose.commonName,
    description: prose.description,
    functions: prose.functions,
    tags: ingredient.tags as IngredientTag[],
    concerns: prose.concerns,
    comedogenicRating: ingredient.comedogenicRating,
    sensitivityImpact: ingredient.sensitivityImpact,
    goodForSkinTypes: ingredient.goodForSkinTypes,
    targetsConcerns: ingredient.targetsConcerns.map((c) => c.slug),
    supportsGoals: ingredient.supportsGoals.map((g) => g.slug),
    isActiveIngredient: ingredient.isActiveIngredient,
    casNumber: ingredient.casNumber,
    cosIngFunctions: ingredient.cosIngFunctions.map((link) => link.function.name),
    regulatory: {
      isFragranceAllergen: ingredient.isFragranceAllergen,
      isRestricted: ingredient.isRestricted,
      isProhibited: ingredient.isProhibited,
      annex: ingredient.cosIngAnnex,
      note: ingredient.restrictionNote,
    },
  };
}

export function toOfferDto(offer: ProductOfferRow): ProductOfferDto {
  return {
    id: offer.id,
    variantId: offer.variantId,
    price: decimalToNumber(offer.price)!,
    currency: offer.currency,
    url: offer.url,
    availability: offer.availability,
    lastCheckedAt: offer.lastCheckedAt.toISOString(),
    store: toStoreDto(offer.store),
  };
}

/** Offers are ordered by price, so the first in-stock one is the best buy. */
function bestOffer(offers: ProductOfferRow[]): ProductOfferRow | null {
  return offers.find((offer) => offer.availability !== 'OUT_OF_STOCK') ?? offers[0] ?? null;
}

/** Every offer of every pack, cheapest first — what the product page lists. */
export function allOffers(row: ProductRow): ProductOfferRow[] {
  return row.variants
    .flatMap((variant) => variant.offers)
    .sort((first, second) => first.price.comparedTo(second.price));
}

/** The pack lists and cards describe; falls back to the cheapest one when none is flagged. */
export function defaultVariant(row: ProductRow): ProductVariantRow | null {
  return row.variants.find((variant) => variant.isDefault) ?? row.variants[0] ?? null;
}

const toVolumeUnit = (unit: ProductVariantRow['volumeUnit']): VolumeUnit =>
  unit.toLowerCase() as VolumeUnit;

export function toVariantDto(variant: ProductVariantRow): ProductVariantDto {
  const offer = bestOffer(variant.offers);
  const lowestPrice = offer ? decimalToNumber(offer.price) : null;
  const volume = decimalToNumber(variant.volume);
  return {
    id: variant.id,
    ean: variant.ean,
    volume,
    volumeUnit: toVolumeUnit(variant.volumeUnit),
    imageUrl: variant.imageUrl,
    isDefault: variant.isDefault,
    lowestPrice,
    pricePerHundred: pricePerHundred(lowestPrice, volume, toVolumeUnit(variant.volumeUnit)),
  };
}

export function toProductSummary(
  row: ProductRow,
  personalMatch?: PersonalMatchDto | null,
): ProductSummaryDto {
  const offers = allOffers(row);
  const offer = bestOffer(offers);
  const pack = defaultVariant(row);
  const variants = row.variants.map(toVariantDto);
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    ean: pack?.ean ?? null,
    imageUrl: pack?.imageUrl ?? null,
    volume: decimalToNumber(pack?.volume),
    volumeUnit: pack ? toVolumeUnit(pack.volumeUnit) : 'ml',
    variants,
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

export function toProductDto(
  row: ProductRow,
  personalMatch: PersonalMatchDto | null | undefined,
  locale: AnswerLocale,
): ProductDto {
  const summary = toProductSummary(row, personalMatch);
  const pack = summary.variants.find((variant) => variant.isDefault) ?? summary.variants[0];
  return {
    ...summary,
    description: row.description,
    usage: row.usage,
    highlights: row.highlights,
    ingredients: row.ingredients.filter(hasMatchedIngredient).map((entry) => ({
      position: entry.position,
      concentrationRange: entry.concentrationRange,
      ingredient: toIngredientDto(entry.ingredient, locale),
    })),
    offers: allOffers(row).map(toOfferDto),
    pricePerHundredMl: pack?.pricePerHundred ?? null,
    source: row.source,
  };
}

/** Converts a database row into the plain shape the scoring engine consumes. */
export function toScorable(row: ProductRow): ScorableProduct {
  const offer = bestOffer(allOffers(row));
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
    ingredients: row.ingredients.filter(hasMatchedIngredient).map((entry) => ({
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
