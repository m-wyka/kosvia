import type { SkinType } from '@kosvia/shared';

/**
 * Plain shapes the scoring engine works on.
 *
 * Deliberately free of Prisma types: the engine is pure, synchronous and
 * unit-testable without a database, and the seed script reuses it directly.
 */

export interface ScorableIngredient {
  id: string;
  inciName: string;
  commonName?: string | null;
  tags: string[];
  /** -2 (often poorly tolerated by reactive skin) … +2 (actively calming). */
  sensitivityImpact: number;
  comedogenicRating: number | null;
  isActiveIngredient: boolean;
  goodForSkinTypes: SkinType[];
  /** BeautyConcern slugs. */
  targetsConcerns: string[];
  /** BeautyGoal slugs. */
  supportsGoals: string[];
}

export interface ScorableProductIngredient {
  position: number;
  ingredient: ScorableIngredient;
}

export interface ScorableProduct {
  id: string;
  name: string;
  categoryId: string;
  categorySlug: string;
  brandId: string;
  isFragranceFree: boolean;
  isVegan: boolean;
  isCrueltyFree: boolean;
  targetSkinTypes: SkinType[];
  ingredientScore: number;
  lowestPrice: number | null;
  ingredients: ScorableProductIngredient[];
}

export interface ScorableProfile {
  skinType: SkinType;
  sensitivity: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  budget: 'UNDER_30' | 'UNDER_50' | 'UNDER_100' | 'UNDER_200' | 'NO_LIMIT';
  fragrancePreference: 'NO_PREFERENCE' | 'PREFER_FRAGRANCE_FREE' | 'REQUIRE_FRAGRANCE_FREE';
  veganPreference: boolean;
  crueltyFreePreference: boolean;
  concernSlugs: string[];
  goalSlugs: string[];
  preferredBrandIds: string[];
  excludedBrandIds: string[];
  /** Avoided by preference — a penalty. */
  excludedIngredientIds: string[];
  /** Declared allergies — a hard block; pass A never returns such products. */
  allergenIngredientIds: string[];
}

/** What the user already owns, so we can flag redundancy. */
export interface ShelfSnapshot {
  productIds: string[];
  categoryIds: string[];
}

/**
 * How much an ingredient at INCI position `position` should count.
 *
 * INCI lists are ordered by decreasing concentration, so position 1 matters far
 * more than position 20. A logarithmic falloff keeps position 2 nearly as
 * important as position 1 while making the tail of the list nearly irrelevant.
 */
export function positionWeight(position: number): number {
  return 1 / (1 + Math.log(Math.max(position, 1)));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
