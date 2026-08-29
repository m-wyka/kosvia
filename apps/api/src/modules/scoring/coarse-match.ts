import { BUDGET_CEILING, DEFAULT_MATCH_WEIGHTS, type MatchWeights } from '@kosvia/shared';
import type { ScorableProfile, ShelfSnapshot } from './types';
import type { ComputedTraits } from './product-traits';

/**
 * Pass A of Personal Match (04_PERSONAL_MATCH.md §2).
 *
 * Sums only the product-dependent, positive contributions that
 * PersonalMatchService can award. Penalties never appear here, and profile-only
 * constants are dropped because they do not change the ordering — so the
 * result is an admissible upper bound on the exact raw delta: for every
 * product and profile, coarseDelta >= exactDelta. The property test in
 * coarse-match.spec.ts guards that invariant.
 *
 * The same formula is emitted as SQL by CoarseMatchService; keep the two in
 * step (the E2E check compares them on the seeded catalogue).
 */

/** Mirrors the fractions PersonalMatchService applies to each group weight. */
export const coarseWeights = (weights: MatchWeights) =>
  ({
    skinTypePositioned: weights.skinType * 0.6,
    skinTypeIngredients: weights.skinType * 0.4,
    concerns: weights.concerns,
    concernsCoverageShare: 0.7,
    concernsDepthShare: 0.3,
    goals: weights.goals,
    goalsCoverageShare: 0.65,
    goalsDepthShare: 0.35,
    fragranceFreeRequired: weights.fragrance * 0.7,
    fragranceFreePreferred: weights.fragrance * 0.55,
    fragranceFreeBonus: 3,
    sensitivityFriendlyMax: weights.sensitivity * 0.6,
    sensitivityFriendlyPerNet: 4,
    sensitivityFriendlyThreshold: 0.8,
    budgetFit: weights.budget * 0.7,
    vegan: weights.ethics * 0.5,
    crueltyFree: weights.ethics * 0.5,
    brandPreferred: weights.brandPreference,
    ingredientQualityPerPoint: weights.ingredientQuality / 50,
    shelfGap: weights.shelfContext * 0.6,
  }) as const;

export type CoarseWeights = ReturnType<typeof coarseWeights>;

export const SENSITIVITY_MULTIPLIER: Record<ScorableProfile['sensitivity'], number> = {
  HIGH: 1,
  MEDIUM: 0.55,
  LOW: 0.15,
  UNKNOWN: 0.4,
};

export interface CoarseProduct {
  brandId: string;
  categoryId: string;
  targetSkinTypes: ScorableProfile['skinType'][];
  isVegan: boolean;
  isCrueltyFree: boolean;
  ingredientScore: number;
  lowestPrice: number | null;
  traits: Pick<
    ComputedTraits,
    | 'hasFragrance'
    | 'skinFitDry'
    | 'skinFitOily'
    | 'skinFitCombination'
    | 'skinFitNormal'
    | 'skinFitSensitive'
    | 'calmingLoad'
    | 'irritantLoad'
    | 'concernSlugs'
    | 'goalSlugs'
  >;
}

const skinFitFor = (traits: CoarseProduct['traits'], skinType: ScorableProfile['skinType']) => {
  switch (skinType) {
    case 'DRY':
      return traits.skinFitDry;
    case 'OILY':
      return traits.skinFitOily;
    case 'COMBINATION':
      return traits.skinFitCombination;
    case 'NORMAL':
      return traits.skinFitNormal;
    case 'SENSITIVE':
      return traits.skinFitSensitive;
    default:
      return 0;
  }
};

const intersectionCount = (left: string[], right: string[]): number =>
  left.filter((value) => right.includes(value)).length;

export const coarseDelta = (
  product: CoarseProduct,
  profile: ScorableProfile,
  shelf?: ShelfSnapshot,
  weights: MatchWeights = DEFAULT_MATCH_WEIGHTS,
): number => {
  const COARSE_WEIGHTS = coarseWeights(weights);
  const { traits } = product;
  let delta = 0;

  if (profile.skinType !== 'UNKNOWN') {
    if (product.targetSkinTypes.includes(profile.skinType)) {
      delta += COARSE_WEIGHTS.skinTypePositioned;
    }
    delta += COARSE_WEIGHTS.skinTypeIngredients * skinFitFor(traits, profile.skinType);
  }

  if (profile.concernSlugs.length) {
    const matched = intersectionCount(traits.concernSlugs, profile.concernSlugs);
    if (matched > 0) {
      const coverage = matched / profile.concernSlugs.length;
      delta +=
        COARSE_WEIGHTS.concerns *
        (coverage * COARSE_WEIGHTS.concernsCoverageShare + COARSE_WEIGHTS.concernsDepthShare);
    }
  }

  if (profile.goalSlugs.length) {
    const matched = intersectionCount(traits.goalSlugs, profile.goalSlugs);
    if (matched > 0) {
      const coverage = matched / profile.goalSlugs.length;
      delta +=
        COARSE_WEIGHTS.goals *
        (coverage * COARSE_WEIGHTS.goalsCoverageShare + COARSE_WEIGHTS.goalsDepthShare);
    }
  }

  if (!traits.hasFragrance) {
    if (profile.fragrancePreference === 'REQUIRE_FRAGRANCE_FREE') {
      delta += COARSE_WEIGHTS.fragranceFreeRequired;
    } else if (profile.fragrancePreference === 'PREFER_FRAGRANCE_FREE') {
      delta += COARSE_WEIGHTS.fragranceFreePreferred;
    } else {
      delta += COARSE_WEIGHTS.fragranceFreeBonus;
    }
  }

  const multiplier = SENSITIVITY_MULTIPLIER[profile.sensitivity];
  const net = traits.calmingLoad - traits.irritantLoad;
  if (
    multiplier > 0 &&
    profile.sensitivity !== 'LOW' &&
    net > COARSE_WEIGHTS.sensitivityFriendlyThreshold
  ) {
    delta +=
      Math.min(
        COARSE_WEIGHTS.sensitivityFriendlyMax,
        net * COARSE_WEIGHTS.sensitivityFriendlyPerNet,
      ) * multiplier;
  }

  const ceiling = BUDGET_CEILING[profile.budget];
  if (ceiling !== null && product.lowestPrice !== null && product.lowestPrice <= ceiling) {
    delta += COARSE_WEIGHTS.budgetFit;
  }

  if (profile.veganPreference && product.isVegan) {
    delta += COARSE_WEIGHTS.vegan;
  }
  if (profile.crueltyFreePreference && product.isCrueltyFree) {
    delta += COARSE_WEIGHTS.crueltyFree;
  }
  if (profile.preferredBrandIds.includes(product.brandId)) {
    delta += COARSE_WEIGHTS.brandPreferred;
  }

  delta += Math.max(0, (product.ingredientScore - 50) * COARSE_WEIGHTS.ingredientQualityPerPoint);

  if (shelf && !shelf.categoryIds.includes(product.categoryId)) {
    delta += COARSE_WEIGHTS.shelfGap;
  }

  return delta;
};
