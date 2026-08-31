/**
 * Kosvia shared domain vocabulary.
 *
 * These string unions mirror the Prisma enums 1:1. They are the single source
 * of truth for option lists rendered in onboarding, filters and the admin panel,
 * so the API and the Nuxt app can never drift apart.
 */

export const SKIN_TYPES = ['DRY', 'OILY', 'COMBINATION', 'NORMAL', 'SENSITIVE', 'UNKNOWN'] as const;
export type SkinType = (typeof SKIN_TYPES)[number];

export const SENSITIVITY_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN'] as const;
export type SensitivityLevel = (typeof SENSITIVITY_LEVELS)[number];

export const FRAGRANCE_PREFERENCES = [
  'NO_PREFERENCE',
  'PREFER_FRAGRANCE_FREE',
  'REQUIRE_FRAGRANCE_FREE',
] as const;
export type FragrancePreference = (typeof FRAGRANCE_PREFERENCES)[number];

export const BUDGET_TIERS = ['UNDER_30', 'UNDER_50', 'UNDER_100', 'UNDER_200', 'NO_LIMIT'] as const;
export type BudgetTier = (typeof BUDGET_TIERS)[number];

export const USER_ROLES = ['USER', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const SUBSCRIPTION_STATUSES = ['FREE', 'PREMIUM', 'CANCELLED'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const AVAILABILITY_STATES = ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'UNKNOWN'] as const;
export type Availability = (typeof AVAILABILITY_STATES)[number];

export const MESSAGE_ROLES = ['USER', 'ASSISTANT'] as const;
export type MessageRole = (typeof MESSAGE_ROLES)[number];

export const ALIAS_KINDS = ['SYNONYM', 'TRANSLATION', 'TYPO', 'TRADE_NAME', 'CI_NUMBER'] as const;
export type AliasKind = (typeof ALIAS_KINDS)[number];

export const CONSENT_TYPES = [
  'TERMS',
  'PRIVACY',
  'BEAUTY_PROFILE_HEALTH',
  'AI_PROCESSING',
  'MARKETING_EMAIL',
] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];

/**
 * Bump a version when the wording of that document changes; users are asked
 * to agree again to the new version.
 */
export const CONSENT_VERSIONS: Record<ConsentType, string> = {
  TERMS: 'terms-2026-08-29',
  PRIVACY: 'privacy-2026-08-29',
  BEAUTY_PROFILE_HEALTH: 'health-2026-08-29',
  AI_PROCESSING: 'ai-2026-08-29',
  MARKETING_EMAIL: 'marketing-2026-08-29',
};

/** Minimum age to use the service without parental consent (Poland). */
export const MINIMUM_AGE = 16;

export const EXCLUSION_REASONS = ['ALLERGY', 'PREFERENCE'] as const;
export type ExclusionReason = (typeof EXCLUSION_REASONS)[number];

export const TOKEN_STATUSES = ['PENDING', 'MAPPED', 'NEW_INGREDIENT', 'IGNORED'] as const;
export type TokenStatus = (typeof TOKEN_STATUSES)[number];

export const APP_REVIEW_STATUSES = ['VISIBLE', 'HIDDEN'] as const;
export type AppReviewStatus = (typeof APP_REVIEW_STATUSES)[number];

export const APP_REVIEW_BODY_MIN_LENGTH = 20;
export const APP_REVIEW_BODY_MAX_LENGTH = 1000;

/** Ingredient functional tags — drives the grouped ingredient UI. */
export const INGREDIENT_TAGS = [
  'humectant',
  'emollient',
  'occlusive',
  'antioxidant',
  'exfoliant',
  'fragrance',
  'preservative',
  'soothing',
  'brightening',
  'barrier-support',
  'uv-filter',
  'surfactant',
  'solvent',
  'thickener',
  'emulsifier',
  'sebum-regulating',
  'retinoid',
  'peptide',
  'ph-adjuster',
  'colorant',
] as const;
export type IngredientTag = (typeof INGREDIENT_TAGS)[number];

/** How a variant's size is expressed; mirrors the Prisma enum, lower-cased for the wire. */
export const VOLUME_UNITS = ['ml', 'g', 'piece'] as const;
export type VolumeUnit = (typeof VOLUME_UNITS)[number];

/** Slugs of BeautyConcern rows created by the seed. */
export const CONCERN_SLUGS = [
  'acne',
  'blackheads',
  'redness',
  'pigmentation',
  'dryness',
  'dehydration',
  'wrinkles',
  'pores',
  'uneven-tone',
] as const;
export type ConcernSlug = (typeof CONCERN_SLUGS)[number];

/** Slugs of BeautyGoal rows created by the seed. */
export const GOAL_SLUGS = [
  'hydration',
  'barrier-support',
  'anti-aging',
  'brightening',
  'acne-care',
  'sun-protection',
  'soothing',
] as const;
export type GoalSlug = (typeof GOAL_SLUGS)[number];

export interface LabelledOption<T extends string = string> {
  value: T;
  label: string;
  description?: string;
}

export const SKIN_TYPE_OPTIONS: LabelledOption<SkinType>[] = [
  { value: 'DRY', label: 'Dry', description: 'Tight, flaky, rarely shiny' },
  { value: 'OILY', label: 'Oily', description: 'Shine returns quickly, visible pores' },
  { value: 'COMBINATION', label: 'Combination', description: 'Oily T-zone, drier cheeks' },
  { value: 'NORMAL', label: 'Normal', description: 'Balanced, few complaints' },
  { value: 'SENSITIVE', label: 'Sensitive', description: 'Reacts easily, stings or flushes' },
  { value: 'UNKNOWN', label: "I'm not sure", description: "We'll keep recommendations gentle" },
];

export const SENSITIVITY_OPTIONS: LabelledOption<SensitivityLevel>[] = [
  { value: 'LOW', label: 'Low', description: 'Skin tolerates most products' },
  { value: 'MEDIUM', label: 'Medium', description: 'Occasional reactions' },
  { value: 'HIGH', label: 'High', description: 'Frequent stinging or redness' },
  { value: 'UNKNOWN', label: 'Not sure', description: 'We default to careful suggestions' },
];

export const FRAGRANCE_OPTIONS: LabelledOption<FragrancePreference>[] = [
  { value: 'NO_PREFERENCE', label: 'No preference' },
  { value: 'PREFER_FRAGRANCE_FREE', label: 'Prefer fragrance-free' },
  { value: 'REQUIRE_FRAGRANCE_FREE', label: 'Only fragrance-free' },
];

export const BUDGET_OPTIONS: LabelledOption<BudgetTier>[] = [
  { value: 'UNDER_30', label: 'Under 30 PLN' },
  { value: 'UNDER_50', label: 'Under 50 PLN' },
  { value: 'UNDER_100', label: 'Under 100 PLN' },
  { value: 'UNDER_200', label: 'Under 200 PLN' },
  { value: 'NO_LIMIT', label: 'No limit' },
];

/**
 * How many points each signal group of Personal Match may contribute
 * (04_PERSONAL_MATCH.md §3). Tuned outside the code: the active
 * MatchWeightSet row overrides these defaults at runtime.
 */
export interface MatchWeights {
  skinType: number;
  concerns: number;
  goals: number;
  ingredientQuality: number;
  fragrance: number;
  sensitivity: number;
  budget: number;
  ethics: number;
  brandPreference: number;
  shelfContext: number;
}

export const MATCH_WEIGHT_KEYS = [
  'skinType',
  'concerns',
  'goals',
  'ingredientQuality',
  'fragrance',
  'sensitivity',
  'budget',
  'ethics',
  'brandPreference',
  'shelfContext',
] as const satisfies ReadonlyArray<keyof MatchWeights>;

export const DEFAULT_MATCH_WEIGHTS: MatchWeights = {
  skinType: 14,
  concerns: 18,
  goals: 16,
  ingredientQuality: 10,
  fragrance: 12,
  sensitivity: 18,
  budget: 10,
  ethics: 8,
  brandPreference: 6,
  shelfContext: 6,
};

/** Upper bound in PLN for a budget tier, or null when unbounded. */
export const BUDGET_CEILING: Record<BudgetTier, number | null> = {
  UNDER_30: 30,
  UNDER_50: 50,
  UNDER_100: 100,
  UNDER_200: 200,
  NO_LIMIT: null,
};
