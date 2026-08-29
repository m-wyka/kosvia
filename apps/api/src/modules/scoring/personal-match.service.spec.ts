import { PersonalMatchService } from './personal-match.service';
import { AQUA, GLYCERIN, NIACINAMIDE, PARFUM, ingredient, product, profile } from './__fixtures__';
import type { ScorableProductIngredient } from './types';

const list = (...entries: Array<ReturnType<typeof ingredient>>): ScorableProductIngredient[] =>
  entries.map((entry, index) => ({ position: index + 1, ingredient: entry }));

describe('PersonalMatchService', () => {
  const service = new PersonalMatchService();

  const hydratingCream = product({
    ingredients: list(AQUA, GLYCERIN, NIACINAMIDE),
    targetSkinTypes: ['COMBINATION'],
    ingredientScore: 70,
    lowestPrice: 45,
  });

  it('falls back to a formula-only score when there is no profile', () => {
    const result = service.score({ product: hydratingCream, profile: null });
    expect(result.personalised).toBe(false);
    expect(result.reasons[0].code).toBe('generic');
    expect(result.warnings).toHaveLength(0);
  });

  it('is deterministic — the same inputs always give the same score', () => {
    const input = { product: hydratingCream, profile: profile() };
    expect(service.score(input).score).toBe(service.score(input).score);
  });

  it('keeps the reported breakdown consistent with the score shown', () => {
    const result = service.score({
      product: hydratingCream,
      profile: profile({
        concernSlugs: ['dehydration'],
        goalSlugs: ['hydration'],
        budget: 'UNDER_50',
      }),
    });
    const sum = [...result.reasons, ...result.warnings].reduce(
      (total, entry) => total + entry.impact,
      0,
    );
    // Impacts are rounded individually, so allow for accumulated rounding.
    expect(Math.abs(50 + sum - result.score)).toBeLessThanOrEqual(
      result.reasons.length + result.warnings.length,
    );
  });

  it('scores a product that targets the user’s concerns above one that does not', () => {
    const targeted = service.score({
      product: hydratingCream,
      profile: profile({ concernSlugs: ['dehydration', 'uneven-tone'] }),
    });
    const untargeted = service.score({
      product: product({ ingredients: list(AQUA, AQUA), ingredientScore: 70 }),
      profile: profile({ concernSlugs: ['dehydration', 'uneven-tone'] }),
    });
    expect(targeted.score).toBeGreaterThan(untargeted.score);
    expect(targeted.reasons.some((r) => r.code === 'concerns')).toBe(true);
  });

  describe('fragrance preference', () => {
    const scented = product({
      isFragranceFree: false,
      ingredients: list(AQUA, GLYCERIN, PARFUM),
      ingredientScore: 70,
    });

    it('heavily penalises fragrance when the user requires fragrance-free', () => {
      const result = service.score({
        product: scented,
        profile: profile({ fragrancePreference: 'REQUIRE_FRAGRANCE_FREE' }),
      });
      expect(result.warnings.some((w) => w.code === 'fragrance-required')).toBe(true);
      expect(result.score).toBeLessThan(50);
    });

    it('penalises it more lightly when the user merely prefers fragrance-free', () => {
      const required = service.score({
        product: scented,
        profile: profile({ fragrancePreference: 'REQUIRE_FRAGRANCE_FREE' }),
      });
      const preferred = service.score({
        product: scented,
        profile: profile({ fragrancePreference: 'PREFER_FRAGRANCE_FREE' }),
      });
      expect(preferred.score).toBeGreaterThan(required.score);
    });

    it('credits a fragrance-free formula when the user asked for one', () => {
      const result = service.score({
        product: hydratingCream,
        profile: profile({ fragrancePreference: 'REQUIRE_FRAGRANCE_FREE' }),
      });
      expect(result.reasons.some((r) => r.code === 'fragrance-free')).toBe(true);
    });
  });

  describe('budget', () => {
    it('credits a product inside the budget', () => {
      const result = service.score({
        product: hydratingCream,
        profile: profile({ budget: 'UNDER_50' }),
      });
      expect(result.reasons.some((r) => r.code === 'budget-fit')).toBe(true);
    });

    it('distinguishes a small stretch from being well over budget', () => {
      const stretch = service.score({
        product: product({ ...hydratingCream, lowestPrice: 34 }),
        profile: profile({ budget: 'UNDER_30' }),
      });
      const over = service.score({
        product: product({ ...hydratingCream, lowestPrice: 120 }),
        profile: profile({ budget: 'UNDER_30' }),
      });
      expect(stretch.warnings.some((w) => w.code === 'budget-stretch')).toBe(true);
      expect(over.warnings.some((w) => w.code === 'budget-over')).toBe(true);
      expect(over.score).toBeLessThan(stretch.score);
    });

    it('ignores price entirely when the budget is unlimited', () => {
      const cheap = service.score({
        product: product({ ...hydratingCream, lowestPrice: 20 }),
        profile: profile(),
      });
      const dear = service.score({
        product: product({ ...hydratingCream, lowestPrice: 300 }),
        profile: profile(),
      });
      expect(cheap.score).toBe(dear.score);
    });
  });

  describe('hard exclusions', () => {
    it('pushes an excluded brand far down', () => {
      const result = service.score({
        product: hydratingCream,
        profile: profile({ excludedBrandIds: ['brand-1'] }),
      });
      expect(result.warnings.some((w) => w.code === 'brand-excluded')).toBe(true);
      expect(result.score).toBeLessThan(30);
    });

    it('warns by name when a product contains an ingredient the user avoids', () => {
      const result = service.score({
        product: hydratingCream,
        profile: profile({ excludedIngredientIds: ['niacinamide'] }),
      });
      const warning = result.warnings.find((w) => w.code === 'ingredient-excluded');
      expect(warning?.label).toContain('Niacinamide');
      // Clients translate on the code, so the raw values have to come with it.
      expect(warning?.params?.ingredients).toEqual(['Niacinamide']);
    });
  });

  describe('sensitivity', () => {
    const harsh = product({
      isFragranceFree: false,
      ingredients: list(
        AQUA,
        PARFUM,
        ingredient({ id: 'alcohol', inciName: 'Alcohol Denat.', sensitivityImpact: -2 }),
      ),
      ingredientScore: 45,
    });

    it('weighs irritant load according to how sensitive the user says they are', () => {
      const high = service.score({ product: harsh, profile: profile({ sensitivity: 'HIGH' }) });
      const low = service.score({ product: harsh, profile: profile({ sensitivity: 'LOW' }) });
      expect(high.score).toBeLessThan(low.score);
    });

    it('credits a calming formula for reactive skin', () => {
      const calming = product({
        ingredients: list(
          AQUA,
          GLYCERIN,
          ingredient({
            id: 'panthenol',
            inciName: 'Panthenol',
            tags: ['soothing'],
            sensitivityImpact: 2,
          }),
          ingredient({
            id: 'bisabolol',
            inciName: 'Bisabolol',
            tags: ['soothing'],
            sensitivityImpact: 2,
          }),
        ),
        ingredientScore: 70,
      });
      const result = service.score({ product: calming, profile: profile({ sensitivity: 'HIGH' }) });
      expect(result.reasons.some((r) => r.code === 'sensitivity-friendly')).toBe(true);
    });
  });

  describe('shelf context', () => {
    it('marks a product the user already owns', () => {
      const result = service.score({
        product: hydratingCream,
        profile: profile(),
        shelf: { productIds: ['product-1'], categoryIds: ['cat-moisturizers'] },
      });
      expect(result.warnings.some((w) => w.code === 'already-owned')).toBe(true);
    });

    it('prefers a product that fills a gap over one that duplicates a category', () => {
      const duplicate = service.score({
        product: hydratingCream,
        profile: profile(),
        shelf: { productIds: ['other'], categoryIds: ['cat-moisturizers'] },
      });
      const gap = service.score({
        product: hydratingCream,
        profile: profile(),
        shelf: { productIds: ['other'], categoryIds: ['cat-cleansers'] },
      });
      expect(gap.score).toBeGreaterThan(duplicate.score);
    });
  });

  it('stays within the 1-99 band even when everything aligns', () => {
    const perfect = service.score({
      product: product({
        ingredients: list(GLYCERIN, NIACINAMIDE, NIACINAMIDE),
        targetSkinTypes: ['COMBINATION'],
        ingredientScore: 100,
        lowestPrice: 10,
      }),
      profile: profile({
        budget: 'UNDER_200',
        concernSlugs: ['dehydration'],
        goalSlugs: ['hydration'],
        fragrancePreference: 'REQUIRE_FRAGRANCE_FREE',
        veganPreference: true,
        crueltyFreePreference: true,
        preferredBrandIds: ['brand-1'],
      }),
      shelf: { productIds: [], categoryIds: [] },
    });
    expect(perfect.score).toBeGreaterThan(80);
    expect(perfect.score).toBeLessThanOrEqual(99);
  });

  describe('translatable reasons', () => {
    it('carries the data behind each sentence, not just the sentence', () => {
      const result = service.score({
        product: product({
          ...hydratingCream,
          targetSkinTypes: ['COMBINATION'],
          lowestPrice: 300,
        }),
        profile: profile({
          skinType: 'COMBINATION',
          budget: 'UNDER_50',
          concernSlugs: ['dehydration'],
          goalSlugs: ['hydration'],
        }),
      });

      const byCode = new Map(
        [...result.reasons, ...result.warnings].map((entry) => [entry.code, entry]),
      );

      expect(byCode.get('skin-type')?.params).toEqual({ skinType: 'COMBINATION' });
      expect(byCode.get('concerns')?.params?.concerns).toEqual(['dehydration']);
      expect(byCode.get('goals')?.params?.goals).toEqual(['hydration']);
      expect(byCode.get('budget-over')?.params).toEqual({ budget: 50 });
    });

    it('gives each distinct message its own code', () => {
      const good = service.score({
        product: product({ ...hydratingCream, ingredientScore: 90 }),
        profile: profile(),
      });
      const poor = service.score({
        product: product({ ...hydratingCream, ingredientScore: 20 }),
        profile: profile(),
      });

      // One code cannot mean both "well built" and "light on actives" — the UI
      // would have nothing else to translate on.
      expect(good.reasons.some((r) => r.code === 'ingredient-quality-good')).toBe(true);
      expect(poor.warnings.some((w) => w.code === 'ingredient-quality-poor')).toBe(true);
    });
  });

  it('scoreMany returns one entry per product', () => {
    const scores = service.scoreMany([hydratingCream, product({ id: 'product-2' })], profile());
    expect([...scores.keys()].sort()).toEqual(['product-1', 'product-2']);
  });
});
