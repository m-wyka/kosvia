import { INGREDIENT_TAGS, SKIN_TYPES } from '@kosvia/shared';
import { coarseDelta } from './coarse-match';
import { PersonalMatchService } from './personal-match.service';
import { computeTraits } from './product-traits';
import type { ScorableIngredient, ScorableProduct, ScorableProfile, ShelfSnapshot } from './types';

/**
 * Property test for 04_PERSONAL_MATCH.md §2: the coarse SQL-able bound must
 * never fall below the exact raw delta. If this fails, someone added a
 * penalty to pass A or a bonus to pass B.
 */

const ITERATIONS = 1500;
const CONCERNS = ['acne', 'redness', 'dryness', 'wrinkles', 'pores', 'pigmentation'];
const GOALS = ['hydration', 'anti-aging', 'brightening', 'soothing', 'sun-protection'];
const BRANDS = ['brand-a', 'brand-b', 'brand-c'];
const CATEGORIES = ['cat-a', 'cat-b', 'cat-c'];
const SENSITIVITIES = ['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN'] as const;
const BUDGETS = ['UNDER_30', 'UNDER_50', 'UNDER_100', 'UNDER_200', 'NO_LIMIT'] as const;
const FRAGRANCE_PREFERENCES = [
  'NO_PREFERENCE',
  'PREFER_FRAGRANCE_FREE',
  'REQUIRE_FRAGRANCE_FREE',
] as const;

/** Small deterministic PRNG so a failure is reproducible from the seed. */
const createRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

const pick = <T>(random: () => number, values: readonly T[]): T =>
  values[Math.floor(random() * values.length)];

const sample = <T>(random: () => number, values: readonly T[], max: number): T[] =>
  values.filter(() => random() < max / values.length);

const randomIngredient = (random: () => number, index: number): ScorableIngredient => ({
  id: `ing-${index}`,
  inciName: `Ingredient ${index}`,
  tags: sample(random, INGREDIENT_TAGS, 2),
  sensitivityImpact: Math.floor(random() * 5) - 2,
  comedogenicRating: null,
  isActiveIngredient: random() < 0.3,
  goodForSkinTypes: sample(random, SKIN_TYPES, 2),
  targetsConcerns: sample(random, CONCERNS, 1.5),
  supportsGoals: sample(random, GOALS, 1.5),
});

const randomProduct = (random: () => number, index: number): ScorableProduct => {
  const count = 1 + Math.floor(random() * 25);
  return {
    id: `product-${index}`,
    name: `Product ${index}`,
    categoryId: pick(random, CATEGORIES),
    categorySlug: 'serums',
    brandId: pick(random, BRANDS),
    isFragranceFree: random() < 0.5,
    isVegan: random() < 0.5,
    isCrueltyFree: random() < 0.5,
    targetSkinTypes: sample(random, SKIN_TYPES, 2),
    ingredientScore: Math.floor(random() * 100),
    lowestPrice: random() < 0.15 ? null : Math.round(random() * 250 * 100) / 100,
    ingredients: Array.from({ length: count }, (_, position) => ({
      position: position + 1,
      ingredient: randomIngredient(random, index * 100 + position),
    })),
  };
};

const randomProfile = (random: () => number): ScorableProfile => ({
  skinType: pick(random, SKIN_TYPES),
  sensitivity: pick(random, SENSITIVITIES),
  budget: pick(random, BUDGETS),
  fragrancePreference: pick(random, FRAGRANCE_PREFERENCES),
  veganPreference: random() < 0.5,
  crueltyFreePreference: random() < 0.5,
  concernSlugs: sample(random, CONCERNS, 2.5),
  goalSlugs: sample(random, GOALS, 2),
  preferredBrandIds: sample(random, BRANDS, 1),
  excludedBrandIds: [],
  excludedIngredientIds: [],
  allergenIngredientIds: [],
});

const randomShelf = (random: () => number): ShelfSnapshot | undefined =>
  random() < 0.3
    ? undefined
    : {
        productIds: [],
        categoryIds: sample(random, CATEGORIES, 1.5),
      };

describe('coarseDelta is an admissible upper bound of the exact delta', () => {
  const service = new PersonalMatchService();

  it(`holds for ${ITERATIONS} random profile/product pairs`, () => {
    const random = createRandom(20260829);
    for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
      const product = randomProduct(random, iteration);
      const profile = randomProfile(random);
      const shelf = randomShelf(random);

      const exact = service
        .contributions(product, profile, shelf)
        .reduce((sum, entry) => sum + entry.impact, 0);
      const traits = computeTraits({
        ingredients: product.ingredients,
        isFragranceFree: product.isFragranceFree,
      });
      const coarse = coarseDelta({ ...product, traits }, profile, shelf);

      if (coarse + 1e-9 < exact) {
        throw new Error(
          `iteration ${iteration}: coarse ${coarse.toFixed(3)} < exact ${exact.toFixed(3)}\n` +
            JSON.stringify({ profile, shelf, product }, null, 2),
        );
      }
    }
  });
});
