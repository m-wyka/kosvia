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

export const toTranslationKey = (identifier: string): string => {
  return identifier.replace(/-/g, '_').toUpperCase();
};

const humanise = (slug: string): string => {
  return slug.replace(/-/g, ' ');
};

export const useVocabulary = () => {
  const { t, te } = useI18n();

  const translateOr = (key: string, fallback: string | null | undefined): string => {
    return te(key) ? t(key) : (fallback ?? '');
  };

  const skinType = (value: SkinType) => t(`VOCAB.SKIN_TYPE.${value}`);
  const sensitivity = (value: SensitivityLevel) => t(`VOCAB.SENSITIVITY.${value}`);
  const budget = (value: BudgetTier) => t(`VOCAB.BUDGET.${value}`);
  const fragrance = (value: FragrancePreference) => t(`VOCAB.FRAGRANCE.${value}`);
  const availability = (value: Availability) => t(`VOCAB.AVAILABILITY.${value}`);
  const matchTier = (value: MatchTier) => t(`VOCAB.MATCH_TIER.${toTranslationKey(value)}`);

  const routineStep = (value: string) =>
    translateOr(`VOCAB.ROUTINE_STEP.${toTranslationKey(value)}`, value);
  const tag = (value: string) =>
    translateOr(`VOCAB.TAG.${toTranslationKey(value)}`, humanise(value));

  const category = (slug: string, apiName?: string | null) =>
    translateOr(`VOCAB.CATEGORY.${toTranslationKey(slug)}`, apiName ?? humanise(slug));
  const categoryDescription = (slug: string, apiDescription?: string | null) =>
    translateOr(`VOCAB.CATEGORY_DESCRIPTION.${toTranslationKey(slug)}`, apiDescription);
  const concern = (slug: string, apiName?: string | null) =>
    translateOr(`VOCAB.CONCERN.${toTranslationKey(slug)}`, apiName ?? humanise(slug));
  const concernHint = (slug: string, apiDescription?: string | null) =>
    translateOr(`VOCAB.CONCERN_HINT.${toTranslationKey(slug)}`, apiDescription);
  const goal = (slug: string, apiName?: string | null) =>
    translateOr(`VOCAB.GOAL.${toTranslationKey(slug)}`, apiName ?? humanise(slug));
  const goalHint = (slug: string, apiDescription?: string | null) =>
    translateOr(`VOCAB.GOAL_HINT.${toTranslationKey(slug)}`, apiDescription);

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
};
