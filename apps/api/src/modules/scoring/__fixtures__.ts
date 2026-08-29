import type { ScorableIngredient, ScorableProduct, ScorableProfile } from './types';

/** Small builders so tests read as intent, not as object literals. */

export function ingredient(
  overrides: Partial<ScorableIngredient> & { id: string },
): ScorableIngredient {
  return {
    inciName: overrides.id,
    tags: [],
    sensitivityImpact: 0,
    comedogenicRating: null,
    isActiveIngredient: false,
    goodForSkinTypes: [],
    targetsConcerns: [],
    supportsGoals: [],
    ...overrides,
  };
}

export function product(overrides: Partial<ScorableProduct> = {}): ScorableProduct {
  return {
    id: 'product-1',
    name: 'Test Cream',
    categoryId: 'cat-moisturizers',
    categorySlug: 'moisturizers',
    brandId: 'brand-1',
    isFragranceFree: true,
    isVegan: true,
    isCrueltyFree: true,
    targetSkinTypes: [],
    ingredientScore: 50,
    lowestPrice: 50,
    ingredients: [],
    ...overrides,
  };
}

export function profile(overrides: Partial<ScorableProfile> = {}): ScorableProfile {
  return {
    skinType: 'COMBINATION',
    sensitivity: 'MEDIUM',
    budget: 'NO_LIMIT',
    fragrancePreference: 'NO_PREFERENCE',
    veganPreference: false,
    crueltyFreePreference: false,
    concernSlugs: [],
    goalSlugs: [],
    preferredBrandIds: [],
    excludedBrandIds: [],
    excludedIngredientIds: [],
    ...overrides,
  };
}

export const GLYCERIN = ingredient({
  id: 'glycerin',
  inciName: 'Glycerin',
  tags: ['humectant'],
  sensitivityImpact: 1,
  goodForSkinTypes: ['DRY', 'COMBINATION', 'OILY', 'NORMAL', 'SENSITIVE'],
  targetsConcerns: ['dehydration', 'dryness'],
  supportsGoals: ['hydration'],
});

export const NIACINAMIDE = ingredient({
  id: 'niacinamide',
  inciName: 'Niacinamide',
  tags: ['brightening', 'barrier-support'],
  sensitivityImpact: 1,
  isActiveIngredient: true,
  goodForSkinTypes: ['COMBINATION', 'OILY'],
  targetsConcerns: ['pores', 'uneven-tone'],
  supportsGoals: ['brightening', 'barrier-support'],
});

export const PARFUM = ingredient({
  id: 'parfum',
  inciName: 'Parfum',
  tags: ['fragrance'],
  sensitivityImpact: -2,
});

export const AQUA = ingredient({ id: 'aqua', inciName: 'Aqua', tags: ['solvent'] });
