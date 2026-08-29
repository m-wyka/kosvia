import { Injectable, Optional } from '@nestjs/common';
import {
  BUDGET_CEILING,
  DEFAULT_MATCH_WEIGHTS,
  type MatchWeights,
  matchTier,
  type MatchReason,
  type MatchReasonParams,
  type PersonalMatchDto,
} from '@kosvia/shared';
import {
  clamp,
  positionWeight,
  type ScorableProduct,
  type ScorableProfile,
  type ShelfSnapshot,
} from './types';
import { MatchWeightService } from './match-weight.service';

/**
 * PersonalMatchService — the "how well does this fit ME?" number.
 *
 * Deterministic on purpose. The same profile and the same product always yield
 * the same score, and every point is attributable to a named reason. The AI
 * layer may *explain* this score in natural language, but it never produces it.
 *
 * The score starts from a neutral baseline and moves on signals grouped into
 * fit (skin type, concerns, goals), preferences (fragrance, ethics, brands),
 * practicality (budget), and context (what the user already owns).
 */

const BASELINE = 50;

/**
 * Half-width of the usable score band. With tanh compression, the score
 * asymptotically approaches BASELINE ± SCALE, so 50 ± 45 gives a 5-95 range.
 */
const SCALE = 45;

const SENSITIVITY_MULTIPLIER: Record<ScorableProfile['sensitivity'], number> = {
  HIGH: 1,
  MEDIUM: 0.55,
  LOW: 0.15,
  UNKNOWN: 0.4,
};

export interface MatchInput {
  product: ScorableProduct;
  profile: ScorableProfile | null;
  shelf?: ShelfSnapshot;
}

@Injectable()
export class PersonalMatchService {
  constructor(@Optional() private readonly weightSets?: MatchWeightService) {}

  /** The active weight set, or the built-in defaults when none is configured. */
  get weights(): MatchWeights {
    return this.weightSets?.current() ?? DEFAULT_MATCH_WEIGHTS;
  }

  /**
   * Scores a single product. When there is no profile the result is still
   * useful — it falls back to formula quality — but `personalised` is false so
   * the UI can invite the user to complete onboarding instead of implying we
   * know them.
   */
  score({ product, profile, shelf }: MatchInput): PersonalMatchDto {
    if (!profile) return this.genericScore(product);
    return this.finalise(this.contributions(product, profile, shelf));
  }

  /**
   * Every signed contribution before compression. Exposed so the coarse
   * (pass A) bound can be checked against the exact delta in tests.
   */
  contributions(
    product: ScorableProduct,
    profile: ScorableProfile,
    shelf?: ShelfSnapshot,
  ): MatchReason[] {
    // Raw contributions are collected first and compressed at the end, so the
    // reported breakdown always adds up to the score the user sees.
    const raw: MatchReason[] = [];
    const WEIGHTS = this.weights;

    // `label` stays the canonical English sentence; `params` carries the raw
    // values so a client can render the same reason in its own language.
    const add = (code: string, label: string, impact: number, params?: MatchReasonParams) => {
      if (Math.abs(impact) < 0.5) return;
      raw.push({ code, label, impact, ...(params ? { params } : {}) });
    };

    /* --------------------------------------------------------- hard blocks -- */

    if (profile.excludedBrandIds.includes(product.brandId)) {
      add('brand-excluded', 'You asked us to skip this brand', -45);
    }

    const allergenHits = product.ingredients.filter((entry) =>
      profile.allergenIngredientIds.includes(entry.ingredient.id),
    );
    if (allergenHits.length) {
      const names = allergenHits.map((entry) => entry.ingredient.inciName).slice(0, 3);
      add('ingredient-allergen', `Contains ${names.join(', ')}, which you are allergic to`, -60, {
        ingredients: names,
      });
    }

    const excludedHits = product.ingredients.filter((entry) =>
      profile.excludedIngredientIds.includes(entry.ingredient.id),
    );
    if (excludedHits.length) {
      const names = excludedHits.map((entry) => entry.ingredient.inciName).slice(0, 3);
      add(
        'ingredient-excluded',
        `Contains ${names.join(', ')}, which you avoid`,
        -clamp(20 + excludedHits.length * 8, 20, 40),
        { ingredients: names },
      );
    }

    /* ---------------------------------------------------------- skin type -- */

    const skinKnown = profile.skinType !== 'UNKNOWN';
    if (skinKnown) {
      const positioned = product.targetSkinTypes.includes(profile.skinType);
      const ingredientFit = this.coverage(product, (ing) =>
        ing.goodForSkinTypes.includes(profile.skinType),
      );

      if (positioned) {
        add(
          'skin-type',
          `Formulated for ${this.readable(profile.skinType)} skin`,
          WEIGHTS.skinType * 0.6,
          { skinType: profile.skinType },
        );
      } else if (product.targetSkinTypes.length) {
        add(
          'skin-type-mismatch',
          `Positioned for ${product.targetSkinTypes.map((t) => this.readable(t)).join(', ')} skin`,
          -WEIGHTS.skinType * 0.45,
          { skinTypes: product.targetSkinTypes },
        );
      }
      add(
        'skin-type-ingredients',
        'Ingredients suit your skin type',
        WEIGHTS.skinType * 0.4 * ingredientFit,
      );
    }

    /* ----------------------------------------------------------- concerns -- */

    if (profile.concernSlugs.length) {
      const matched = new Set<string>();
      let weightedHits = 0;
      for (const entry of product.ingredients) {
        for (const slug of entry.ingredient.targetsConcerns) {
          if (profile.concernSlugs.includes(slug)) {
            matched.add(slug);
            weightedHits += positionWeight(entry.position);
          }
        }
      }
      const coverage = matched.size / profile.concernSlugs.length;
      const depth = clamp(weightedHits / 2, 0, 1);
      const impact = WEIGHTS.concerns * (coverage * 0.7 + depth * 0.3);
      if (matched.size) {
        add(
          'concerns',
          `Targets ${[...matched].map((s) => this.readableSlug(s)).join(', ')}`,
          impact,
          {
            concerns: [...matched],
          },
        );
      } else {
        add(
          'concerns-none',
          'Nothing here specifically addresses your concerns',
          -WEIGHTS.concerns * 0.3,
        );
      }
    }

    /* -------------------------------------------------------------- goals -- */

    if (profile.goalSlugs.length) {
      const matched = new Set<string>();
      let weightedHits = 0;
      for (const entry of product.ingredients) {
        for (const slug of entry.ingredient.supportsGoals) {
          if (profile.goalSlugs.includes(slug)) {
            matched.add(slug);
            weightedHits += positionWeight(entry.position);
          }
        }
      }
      if (matched.size) {
        const coverage = matched.size / profile.goalSlugs.length;
        const depth = clamp(weightedHits / 2.5, 0, 1);
        add(
          'goals',
          `Works towards ${[...matched].map((s) => this.readableSlug(s)).join(', ')}`,
          WEIGHTS.goals * (coverage * 0.65 + depth * 0.35),
          { goals: [...matched] },
        );
      }
    }

    /* ---------------------------------------------------------- fragrance -- */

    const fragranceEntries = product.ingredients.filter((entry) =>
      entry.ingredient.tags.includes('fragrance'),
    );
    const hasFragrance = !product.isFragranceFree || fragranceEntries.length > 0;

    if (profile.fragrancePreference === 'REQUIRE_FRAGRANCE_FREE') {
      if (hasFragrance) {
        add('fragrance-required', 'Contains fragrance, which you have ruled out', -30);
      } else {
        add('fragrance-free', 'Fragrance-free, as you asked', WEIGHTS.fragrance * 0.7);
      }
    } else if (profile.fragrancePreference === 'PREFER_FRAGRANCE_FREE') {
      if (hasFragrance) {
        add('fragrance-present', 'Contains fragrance', -WEIGHTS.fragrance);
      } else {
        add('fragrance-free', 'Fragrance-free, which you prefer', WEIGHTS.fragrance * 0.55);
      }
    } else if (!hasFragrance) {
      add('fragrance-free-bonus', 'Fragrance-free formula', 3);
    }

    /* -------------------------------------------------------- sensitivity -- */

    const multiplier = SENSITIVITY_MULTIPLIER[profile.sensitivity];
    if (multiplier > 0) {
      let irritantLoad = 0;
      let calmingLoad = 0;
      for (const entry of product.ingredients) {
        const impact = entry.ingredient.sensitivityImpact;
        if (impact < 0) irritantLoad += -impact * positionWeight(entry.position);
        if (impact > 0) calmingLoad += impact * positionWeight(entry.position);
      }
      const net = calmingLoad - irritantLoad;
      if (net < -0.4) {
        add(
          'sensitivity-risk',
          'Several ingredients here are commonly reported as poorly tolerated by reactive skin',
          -clamp(Math.abs(net) * 6, 3, WEIGHTS.sensitivity) * multiplier,
        );
      } else if (net > 0.8 && profile.sensitivity !== 'LOW') {
        add(
          'sensitivity-friendly',
          'Built around calming, well-tolerated ingredients',
          clamp(net * 4, 2, WEIGHTS.sensitivity * 0.6) * multiplier,
        );
      }
    }

    /* ------------------------------------------------------------- budget -- */

    const ceiling = BUDGET_CEILING[profile.budget];
    if (ceiling !== null && product.lowestPrice !== null) {
      if (product.lowestPrice <= ceiling) {
        add('budget-fit', 'Fits your budget', WEIGHTS.budget * 0.7);
      } else if (product.lowestPrice <= ceiling * 1.25) {
        add('budget-stretch', `Slightly above your ${ceiling} PLN budget`, -WEIGHTS.budget * 0.4, {
          budget: ceiling,
        });
      } else {
        add('budget-over', `Well above your ${ceiling} PLN budget`, -WEIGHTS.budget, {
          budget: ceiling,
        });
      }
    }

    /* ------------------------------------------------------------- ethics -- */

    if (profile.veganPreference) {
      add(
        product.isVegan ? 'vegan-match' : 'vegan-mismatch',
        product.isVegan ? 'Vegan formula' : 'Not marked as vegan',
        product.isVegan ? WEIGHTS.ethics * 0.5 : -WEIGHTS.ethics * 0.75,
      );
    }
    if (profile.crueltyFreePreference) {
      add(
        product.isCrueltyFree ? 'cruelty-free-match' : 'cruelty-free-mismatch',
        product.isCrueltyFree ? 'Cruelty-free brand' : 'Brand is not certified cruelty-free',
        product.isCrueltyFree ? WEIGHTS.ethics * 0.5 : -WEIGHTS.ethics * 0.75,
      );
    }

    /* -------------------------------------------------------------- brand -- */

    if (profile.preferredBrandIds.includes(product.brandId)) {
      add('brand-preferred', 'From a brand you like', WEIGHTS.brandPreference);
    }

    /* -------------------------------------------- formula quality & shelf -- */

    add(
      product.ingredientScore >= 50 ? 'ingredient-quality-good' : 'ingredient-quality-poor',
      product.ingredientScore >= 50
        ? 'Well-built formula'
        : 'Formula is light on active ingredients',
      ((product.ingredientScore - 50) / 50) * WEIGHTS.ingredientQuality,
    );

    if (shelf) {
      if (shelf.productIds.includes(product.id)) {
        add('already-owned', 'Already on your shelf', -WEIGHTS.shelfContext);
      } else if (shelf.categoryIds.includes(product.categoryId)) {
        add(
          'category-owned',
          'You already have something in this category',
          -WEIGHTS.shelfContext * 0.5,
        );
      } else {
        add('shelf-gap', 'Fills a gap in your current routine', WEIGHTS.shelfContext * 0.6);
      }
    }

    return raw;
  }

  /**
   * Turns raw contributions into a 1-99 score.
   *
   * Signals are summed, then squashed with tanh so that a product matching
   * every single criterion lands near the top of the scale rather than pinning
   * at 99 alongside every other strong match — which is what makes the ranking
   * useful in the first place. Each reported impact is scaled by exactly the
   * same ratio, so the "Why?" breakdown still adds up to the number shown.
   */
  private finalise(raw: MatchReason[]): PersonalMatchDto {
    const delta = raw.reduce((sum, entry) => sum + entry.impact, 0);
    const compressed = SCALE * Math.tanh(delta / SCALE);
    const ratio = delta === 0 ? 1 : compressed / delta;

    const scaled = raw.map((entry) => ({ ...entry, impact: Math.round(entry.impact * ratio) }));
    const score = clamp(Math.round(BASELINE + compressed), 1, 99);

    return {
      score,
      tier: matchTier(score),
      reasons: scaled.filter((entry) => entry.impact > 0).sort((a, b) => b.impact - a.impact),
      warnings: scaled.filter((entry) => entry.impact < 0).sort((a, b) => a.impact - b.impact),
      personalised: true,
    };
  }

  /** Batch helper — the list endpoints score many products against one profile. */
  scoreMany(
    products: ScorableProduct[],
    profile: ScorableProfile | null,
    shelf?: ShelfSnapshot,
  ): Map<string, PersonalMatchDto> {
    const result = new Map<string, PersonalMatchDto>();
    for (const product of products) {
      result.set(product.id, this.score({ product, profile, shelf }));
    }
    return result;
  }

  /**
   * Formula-quality-only score, used before a user has told us anything.
   *
   * It returns the ingredient score unchanged rather than a rescaled version of
   * it. Deriving a second number would put two different figures on the same
   * page under the same label, and with no profile the formula score genuinely
   * is the whole answer.
   */
  private genericScore(product: ScorableProduct): PersonalMatchDto {
    const score = clamp(product.ingredientScore, 1, 99);
    return {
      score,
      tier: matchTier(score),
      reasons: [
        {
          code: 'generic',
          label: 'Based on formula quality alone — complete your profile for a personal score',
          impact: 0,
        },
      ],
      warnings: [],
      personalised: false,
    };
  }

  private coverage(
    product: ScorableProduct,
    predicate: (ingredient: ScorableProduct['ingredients'][number]['ingredient']) => boolean,
  ): number {
    const considered = product.ingredients.filter((entry) => entry.position <= 12);
    if (!considered.length) return 0;
    let hit = 0;
    let total = 0;
    for (const entry of considered) {
      const weight = positionWeight(entry.position);
      total += weight;
      if (predicate(entry.ingredient)) hit += weight;
    }
    return total ? clamp(hit / total, 0, 1) : 0;
  }

  private readable(value: string): string {
    return value.toLowerCase().replace(/_/g, ' ');
  }

  private readableSlug(slug: string): string {
    return slug.replace(/-/g, ' ');
  }
}
