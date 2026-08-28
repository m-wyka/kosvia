import {
  BUDGET_TIERS,
  FRAGRANCE_PREFERENCES,
  SENSITIVITY_LEVELS,
  SKIN_TYPES,
  type Availability,
  type BudgetTier,
  type FragrancePreference,
  type LabelledOption,
  type MatchTier,
  type SensitivityLevel,
  type SkinType,
} from '@kosvia/shared';

/**
 * Turns an API identifier into a translation key.
 *
 * The backend speaks in slugs (`eye-care`, `barrier-support`) and enum members
 * (`IN_STOCK`); translation keys are UPPER_SNAKE_CASE. This is the single place
 * that bridges the two, so no component has to hand-build a key.
 */
export function toTranslationKey(identifier: string): string {
  return identifier.replace(/-/g, '_').toUpperCase();
}

/**
 * Translations for the controlled vocabularies the API speaks in.
 *
 * The backend returns stable identifiers alongside English display names. Those
 * names are right for API consumers, but the UI renders the identifier through
 * its own translations instead, so one response reads correctly in either
 * language.
 *
 * Free-text catalogue content (product names, descriptions, ingredient
 * descriptions) is deliberately not covered: translating that means translated
 * columns in the database, not a lookup table. See the README.
 */
export function useVocabulary() {
  const { t, te } = useI18n();

  /** Uses our translation when we have one, otherwise the API's own wording. */
  function translateOr(key: string, fallback: string | null | undefined): string {
    return te(key) ? t(key) : (fallback ?? '');
  }

  const skinType = (value: SkinType) => t(`VOCAB.SKIN_TYPE.${value}`);
  const sensitivity = (value: SensitivityLevel) => t(`VOCAB.SENSITIVITY.${value}`);
  const budget = (value: BudgetTier) => t(`VOCAB.BUDGET.${value}`);
  const fragrance = (value: FragrancePreference) => t(`VOCAB.FRAGRANCE.${value}`);
  const availability = (value: Availability) => t(`VOCAB.AVAILABILITY.${value}`);
  const matchTier = (value: MatchTier) => t(`VOCAB.MATCH_TIER.${toTranslationKey(value)}`);

  const routineStep = (value: string) =>
    translateOr(`VOCAB.ROUTINE_STEP.${toTranslationKey(value)}`, value);
  const tag = (value: string) =>
    translateOr(`VOCAB.TAG.${toTranslationKey(value)}`, value.replace(/-/g, ' '));

  const category = (slug: string, apiName?: string | null) =>
    translateOr(`VOCAB.CATEGORY.${toTranslationKey(slug)}`, apiName ?? slug.replace(/-/g, ' '));
  const categoryDescription = (slug: string, apiDescription?: string | null) =>
    translateOr(`VOCAB.CATEGORY_DESCRIPTION.${toTranslationKey(slug)}`, apiDescription);
  const concern = (slug: string, apiName?: string | null) =>
    translateOr(`VOCAB.CONCERN.${toTranslationKey(slug)}`, apiName ?? slug.replace(/-/g, ' '));
  const concernHint = (slug: string, apiDescription?: string | null) =>
    translateOr(`VOCAB.CONCERN_HINT.${toTranslationKey(slug)}`, apiDescription);
  const goal = (slug: string, apiName?: string | null) =>
    translateOr(`VOCAB.GOAL.${toTranslationKey(slug)}`, apiName ?? slug.replace(/-/g, ' '));
  const goalHint = (slug: string, apiDescription?: string | null) =>
    translateOr(`VOCAB.GOAL_HINT.${toTranslationKey(slug)}`, apiDescription);

  /* ---------------------------------------------------- option lists ------ */

  const skinTypeOptions = computed<LabelledOption<SkinType>[]>(() =>
    SKIN_TYPES.map((value) => ({
      value,
      label: skinType(value),
      description: t(`VOCAB.SKIN_TYPE_HINT.${value}`),
    })),
  );

  const sensitivityOptions = computed<LabelledOption<SensitivityLevel>[]>(() =>
    SENSITIVITY_LEVELS.map((value) => ({
      value,
      label: sensitivity(value),
      description: t(`VOCAB.SENSITIVITY_HINT.${value}`),
    })),
  );

  const budgetOptions = computed<LabelledOption<BudgetTier>[]>(() =>
    BUDGET_TIERS.map((value) => ({ value, label: budget(value) })),
  );

  const fragranceOptions = computed<LabelledOption<FragrancePreference>[]>(() =>
    FRAGRANCE_PREFERENCES.map((value) => ({ value, label: fragrance(value) })),
  );

  /** Skin types minus UNKNOWN — filters and admin forms never offer it. */
  const concreteSkinTypes = computed(() => SKIN_TYPES.filter((value) => value !== 'UNKNOWN'));

  return {
    skinType,
    sensitivity,
    budget,
    fragrance,
    availability,
    matchTier,
    routineStep,
    tag,
    category,
    categoryDescription,
    concern,
    concernHint,
    goal,
    goalHint,
    skinTypeOptions,
    sensitivityOptions,
    budgetOptions,
    fragranceOptions,
    concreteSkinTypes,
  };
}
