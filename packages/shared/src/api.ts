import type {
  Availability,
  BudgetTier,
  FragrancePreference,
  IngredientTag,
  LimitMetric,
  MessageRole,
  PlanLimits,
  PlanTier,
  SensitivityLevel,
  SkinType,
  ConsentType,
  ExclusionReason,
  MatchWeights,
  SubscriptionPeriod,
  SubscriptionState,
  SubscriptionStatus,
  TokenStatus,
  UserRole,
  VolumeUnit,
} from './domain.js';

/**
 * Wire contracts between the NestJS API and the Nuxt app.
 *
 * Note the deliberate three-way split described in the product spec:
 *   RAW DATA      — ProductDto, IngredientDto, OfferDto (facts from the DB)
 *   COMPUTED DATA — PersonalMatchDto, IngredientScoreDto (deterministic services)
 *   AI OUTPUT     — AiChatResponse.answer (natural language only, never facts)
 */

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  /** Machine-readable reason, e.g. CONSENT_REQUIRED. */
  code?: string;
  /** Which consent is missing when `code` is CONSENT_REQUIRED. */
  consent?: ConsentType;
  /** Which feature ceiling was hit when `code` is PLAN_LIMIT_REACHED. */
  metric?: LimitMetric;
  /** The ceiling that was hit, for rendering the upsell copy. */
  limit?: number;
  path?: string;
  timestamp?: string;
}

/* -------------------------------------------------------------------------- */
/* Auth & user                                                                */
/* -------------------------------------------------------------------------- */

/** Which consents are currently in force — the latest event per type. */
export type ConsentState = Record<ConsentType, boolean>;

export interface UserDto {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  subscriptionStatus: SubscriptionStatus;
  hasBeautyProfile: boolean;
  consents: ConsentState;
  /** Set while an account deletion is pending; the hard delete runs at this time. */
  deletionScheduledFor: string | null;
  createdAt: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name?: string;
  /** ISO date (YYYY-MM-DD); the account is refused under MINIMUM_AGE. */
  birthDate: string;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  healthConsent?: boolean;
  aiConsent?: boolean;
}

export interface ConsentEventDto {
  type: ConsentType;
  version: string;
  granted: boolean;
  createdAt: string;
}

export interface ConsentsDto {
  current: ConsentState;
  history: ConsentEventDto[];
}

/** Error body code the API returns when an endpoint needs a consent the user has not given. */
export const CONSENT_REQUIRED_CODE = 'CONSENT_REQUIRED';

/** Error body code for endpoints reserved for the Premium plan. */
export const PREMIUM_REQUIRED_CODE = 'PREMIUM_REQUIRED';

/** Error body code for a monthly or absolute plan ceiling that has been hit. */
export const PLAN_LIMIT_REACHED_CODE = 'PLAN_LIMIT_REACHED';

/* -------------------------------------------------------------------------- */
/* Subscription & entitlements                                                */
/* -------------------------------------------------------------------------- */

/** Admin-editable pricing of one billing period of Premium. */
export interface SubscriptionPlanDto {
  period: SubscriptionPeriod;
  /** Minor units (grosze) — 1999 renders as 19,99 zł. */
  priceMinor: number;
  currency: string;
  isActive: boolean;
  updatedAt: string | null;
}

export interface SubscriptionDto {
  period: SubscriptionPeriod;
  state: SubscriptionState;
  startedAt: string;
  expiresAt: string | null;
  canceledAt: string | null;
}

/** Usage of one limited feature within the current monthly window. */
export interface EntitlementUsageDto {
  /** null = unlimited on the current plan. */
  limit: number | null;
  used: number;
  remaining: number | null;
}

export interface SubscriptionOverviewDto {
  plan: PlanTier;
  subscription: SubscriptionDto | null;
  limits: PlanLimits;
  entitlements: {
    aiMessages: EntitlementUsageDto;
    personalMatch: EntitlementUsageDto;
    priceAlerts: EntitlementUsageDto;
    shelfItems: EntitlementUsageDto;
  };
  /** ISO date of the first day of the next usage window. */
  usageResetsAt: string;
}

export interface UpdateSubscriptionPlanPayload {
  priceMinor?: number;
  currency?: string;
  isActive?: boolean;
}

export interface AccountExportDto {
  exportedAt: string;
  account: Omit<UserDto, 'consents' | 'deletionScheduledFor'> & { birthDate: string | null };
  beautyProfile: BeautyProfileDto | null;
  consents: ConsentEventDto[];
  shelf: unknown[];
  priceAlerts: unknown[];
  comparisons: unknown[];
  conversations: unknown[];
  skinDiary: unknown[];
}

export interface AuthResponse {
  user: UserDto;
  /** Short-lived access token. Also set as an HttpOnly cookie by the API. */
  accessToken: string;
}

/* -------------------------------------------------------------------------- */
/* Beauty profile                                                             */
/* -------------------------------------------------------------------------- */

export interface TaxonomyItemDto {
  id: string;
  slug: string;
  name: string;
  description: string | null;
}

export interface BeautyProfileDto {
  id: string;
  skinType: SkinType;
  sensitivity: SensitivityLevel;
  budget: BudgetTier;
  fragrancePreference: FragrancePreference;
  veganPreference: boolean;
  crueltyFreePreference: boolean;
  concerns: TaxonomyItemDto[];
  goals: TaxonomyItemDto[];
  preferredBrands: BrandSummaryDto[];
  excludedBrands: BrandSummaryDto[];
  excludedIngredients: ExcludedIngredientDto[];
  updatedAt: string;
}

/** ALLERGY hides the product outright; PREFERENCE only lowers its score. */
export interface ExcludedIngredientDto extends IngredientSummaryDto {
  reason: ExclusionReason;
}

export interface ExcludedIngredientInput {
  ingredientId: string;
  reason: ExclusionReason;
}

export interface UpdateBeautyProfilePayload {
  skinType?: SkinType;
  sensitivity?: SensitivityLevel;
  budget?: BudgetTier;
  fragrancePreference?: FragrancePreference;
  veganPreference?: boolean;
  crueltyFreePreference?: boolean;
  concernSlugs?: string[];
  goalSlugs?: string[];
  preferredBrandIds?: string[];
  excludedBrandIds?: string[];
  /** Legacy shorthand — every id is stored as a PREFERENCE. */
  excludedIngredientIds?: string[];
  excludedIngredients?: ExcludedIngredientInput[];
}

/* -------------------------------------------------------------------------- */
/* Catalogue — RAW DATA                                                       */
/* -------------------------------------------------------------------------- */

export interface BrandSummaryDto {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
}

export interface BrandDto extends BrandSummaryDto {
  description: string | null;
  isVegan: boolean;
  isCrueltyFree: boolean;
  productCount?: number;
}

export interface CategoryDto {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  description: string | null;
  children?: CategoryDto[];
  productCount?: number;
}

export interface IngredientSummaryDto {
  id: string;
  inciName: string;
  commonName: string | null;
  tags: IngredientTag[];
}

export interface IngredientDto extends IngredientSummaryDto {
  slug: string;
  description: string | null;
  functions: string[];
  concerns: string | null;
  comedogenicRating: number | null;
  /** -2 … +2 — how well this ingredient is generally tolerated by reactive skin. */
  sensitivityImpact: number;
  goodForSkinTypes: SkinType[];
  targetsConcerns: string[];
  supportsGoals: string[];
  /** True for headline actives — retinoids, acids, vitamin C and the like. */
  isActiveIngredient: boolean;
  casNumber: string | null;
  /** CosIng function names, verbatim ("HUMECTANT", "SKIN CONDITIONING"). */
  cosIngFunctions: string[];
  /** Regulatory facts from CosIng Annexes II–VI — stated, never interpreted. */
  regulatory: IngredientRegulatoryDto;
}

export interface IngredientRegulatoryDto {
  /** Annex III entry with a labelling obligation — Regulation (EU) 2023/1545. */
  isFragranceAllergen: boolean;
  /** Listed in Annex III (restricted use). */
  isRestricted: boolean;
  /** Listed in Annex II (prohibited in cosmetic products). */
  isProhibited: boolean;
  /** "II" | "III" | "IV" | "V" | "VI" */
  annex: string | null;
  /** Maximum concentration and conditions of use, quoted from the annex. */
  note: string | null;
}

export interface ProductIngredientDto {
  position: number;
  concentrationRange: string | null;
  ingredient: IngredientDto;
}

export interface StoreDto {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  websiteUrl: string | null;
}

/** One sellable pack of a product — 50 ml and 100 ml are two variants of one formula. */
export interface ProductVariantDto {
  id: string;
  ean: string | null;
  volume: number | null;
  volumeUnit: VolumeUnit;
  imageUrl: string | null;
  isDefault: boolean;
  /** Cheapest in-stock offer for this pack. */
  lowestPrice: number | null;
  pricePerHundred: number | null;
}

export interface ProductOfferDto {
  id: string;
  variantId: string;
  price: number;
  currency: string;
  url: string | null;
  availability: Availability;
  lastCheckedAt: string;
  store: StoreDto;
}

export interface ProductSummaryDto {
  id: string;
  name: string;
  slug: string;
  /** Barcode, size and photo of the default variant — the pack lists and cards show. */
  ean: string | null;
  imageUrl: string | null;
  volume: number | null;
  volumeUnit: VolumeUnit;
  /** Every pack the product is sold in, default first. */
  variants: ProductVariantDto[];
  isFragranceFree: boolean;
  isVegan: boolean;
  isCrueltyFree: boolean;
  brand: BrandSummaryDto;
  category: CategoryDto;
  /** Cheapest active offer, denormalised for list rendering. */
  lowestPrice: number | null;
  lowestPriceStore: StoreDto | null;
  /** COMPUTED — deterministic 0-100 ingredient quality signal. */
  ingredientScore: number;
  /** COMPUTED — present only when the caller is authenticated with a profile. */
  personalMatch?: PersonalMatchDto | null;
}

/** Diff between the two newest imported compositions of a product. */
export interface FormulaChangeDto {
  changedAt: string;
  addedIngredients: string[];
  removedIngredients: string[];
  isReordered: boolean;
}

export interface ProductDto extends ProductSummaryDto {
  description: string | null;
  usage: string | null;
  highlights: string[];
  ingredients: ProductIngredientDto[];
  offers: ProductOfferDto[];
  pricePerHundredMl: number | null;
  /** Where the record came from; drives the licence attribution on the page. */
  source: DataSourceDto | null;
  /** Set only on the product-page read when the imported label changed recently. */
  recentFormulaChange?: FormulaChangeDto | null;
  /**
   * True when a Free viewer exhausted the monthly full-analysis quota — the
   * personalMatch is then the generic score and the UI should offer Premium.
   */
  matchLimitReached?: boolean;
}

export interface DataSourceDto {
  code: string;
  name: string;
  license: string;
  attribution: string | null;
  url: string | null;
}

/* -------------------------------------------------------------------------- */
/* Search                                                                     */
/* -------------------------------------------------------------------------- */

export type ProductSort =
  | 'recommended'
  | 'price-asc'
  | 'price-desc'
  | 'price-per-100'
  | 'best-match'
  | 'ingredient-score'
  | 'newest';

export interface ProductSearchQuery {
  q?: string;
  category?: string;
  brand?: string | string[];
  ingredient?: string | string[];
  skinType?: SkinType;
  minPrice?: number;
  maxPrice?: number;
  fragranceFree?: boolean;
  vegan?: boolean;
  crueltyFree?: boolean;
  spf?: boolean;
  sort?: ProductSort;
  page?: number;
  pageSize?: number;
}

/** How many products in the current result set carry each formula trait. */
export interface FormulaFacetsDto {
  fragranceFree: number;
  vegan: number;
  crueltyFree: number;
  spf: number;
}

export interface ProductFacetsDto {
  brands: Array<BrandSummaryDto & { count: number }>;
  categories: Array<{ id: string; name: string; slug: string; count: number }>;
  priceRange: { min: number; max: number };
  formula: FormulaFacetsDto;
}

/** A lightweight autocomplete hit — see GET /products/suggest. */
export interface ProductSuggestionDto {
  id: string;
  name: string;
  slug: string;
  brandName: string;
  imageUrl: string | null;
}

export interface ProductSearchResult extends PaginatedResult<ProductSummaryDto> {
  facets: ProductFacetsDto;
}

/* -------------------------------------------------------------------------- */
/* COMPUTED DATA                                                              */
/* -------------------------------------------------------------------------- */

export type MatchTier = 'perfect' | 'great' | 'good' | 'fair' | 'poor';

export interface MatchReason {
  /** Stable identifier — the frontend translates on this, never on `label`. */
  code: string;
  /**
   * English rendering of the reason.
   *
   * Kept as the canonical form for API consumers and for the AI prompt, which
   * reasons about text rather than keys. The UI ignores it and renders `code`
   * plus `params` through its own translations.
   */
  label: string;
  /** Signed contribution to the final score, for the "Why?" breakdown. */
  impact: number;
  /** Raw values behind the sentence: slugs, enum members, numbers. */
  params?: MatchReasonParams;
}

/**
 * A sentence the API generated, in a form a client can re-render in its own
 * language.
 *
 * The same contract as MatchReason, generalised: `code` is what the UI
 * translates on, `text` is the canonical English for API consumers and for the
 * AI prompt, and `params` carries the raw values behind the wording. A client
 * that does not recognise the code falls back to `text`.
 */
export interface LocalisedText {
  code: string;
  text: string;
  params?: Record<string, string | number | string[]>;
}

export interface MatchReasonParams {
  skinType?: SkinType;
  skinTypes?: SkinType[];
  /** BeautyConcern slugs. */
  concerns?: string[];
  /** BeautyGoal slugs. */
  goals?: string[];
  /** INCI names, already human-readable in any language. */
  ingredients?: string[];
  budget?: number;
}

export interface PersonalMatchDto {
  score: number;
  tier: MatchTier;
  reasons: MatchReason[];
  warnings: MatchReason[];
  /** False when the user has no beauty profile — score is then generic. */
  personalised: boolean;
  /**
   * Every signed contribution behind the score, before compression — the full
   * "Why?" breakdown. Present only for Premium viewers on the product page.
   */
  breakdown?: MatchReason[];
}

export interface IngredientScoreBreakdownDto {
  score: number;
  activeCount: number;
  supportiveCount: number;
  potentialIrritantCount: number;
  notes: LocalisedText[];
}

export type AlternativeKind =
  'cheaper' | 'better-match' | 'better-value' | 'similar-ingredients' | 'similar-purpose';

export interface AlternativeGroupDto {
  kind: AlternativeKind;
  title: string;
  description: string;
  products: Array<ProductSummaryDto & { alternativeReason: LocalisedText }>;
}

export interface ComparisonRowDto {
  key: string;
  label: string;
  /** One entry per compared product, aligned by index. */
  values: Array<string | number | null>;
  /** Index of the winning product for this row, when a winner exists. */
  bestIndex: number | null;
  /** `higher` / `lower` — which direction wins. */
  direction: 'higher' | 'lower' | 'none';
}

export interface ComparisonVerdictDto {
  productId: string;
  productName: string;
  summary: LocalisedText;
  reasons: LocalisedText[];
}

export interface ComparisonResultDto {
  products: ProductDto[];
  rows: ComparisonRowDto[];
  verdict: ComparisonVerdictDto | null;
}

/* -------------------------------------------------------------------------- */
/* Shelf & routine                                                            */
/* -------------------------------------------------------------------------- */

export interface ShelfItemDto {
  id: string;
  addedAt: string;
  openedAt: string | null;
  finishedAt: string | null;
  isFavorite: boolean;
  notes: string | null;
  /** Effective period-after-opening in months (product label override, else category default). */
  paoMonths: number | null;
  product: ProductSummaryDto;
}

export interface RoutineObservationDto {
  kind: 'overlap' | 'gap' | 'ingredient-overlap' | 'balance';
  severity: 'info' | 'notice';
  title: LocalisedText;
  detail: LocalisedText;
  productIds: string[];
}

export const REGULATORY_CHANGE_KINDS = [
  'became-prohibited',
  'became-restricted',
  'prohibition-lifted',
  'restriction-lifted',
] as const;
export type RegulatoryChangeKind = (typeof REGULATORY_CHANGE_KINDS)[number];

/** A recent Annex II/III change affecting products on the user's shelf. */
export interface RegulatoryAlertDto {
  ingredientId: string;
  inciName: string;
  slug: string;
  kind: RegulatoryChangeKind;
  newAnnex: string | null;
  changedAt: string;
  products: ProductSummaryDto[];
}

export interface RoutinePlanAssignmentDto {
  productId: string;
  productSlug: string;
  productName: string;
  /** RoutineStep enum value, translated on the client through the vocabulary. */
  step: string;
  reason: LocalisedText;
}

export interface RoutinePlanDayDto {
  /** 0 = Monday … 6 = Sunday. */
  day: number;
  morning: RoutinePlanAssignmentDto[];
  evening: RoutinePlanAssignmentDto[];
}

/** A descriptive weekly AM/PM suggestion built from the shelf — never a prescription. */
export interface RoutinePlanDto {
  itemCount: number;
  days: RoutinePlanDayDto[];
  unscheduled: RoutinePlanAssignmentDto[];
  notes: LocalisedText[];
}

export interface RoutineAnalysisDto {
  itemCount: number;
  coveredCategories: string[];
  missingCategories: Array<{ slug: string; name: string; why: LocalisedText }>;
  observations: RoutineObservationDto[];
}

/* -------------------------------------------------------------------------- */
/* Price alerts                                                               */
/* -------------------------------------------------------------------------- */

export interface PriceAlertDto {
  id: string;
  targetPrice: number;
  active: boolean;
  createdAt: string;
  product: ProductSummaryDto;
  /** True when the current lowest offer already meets the target. */
  triggered: boolean;
}

/* -------------------------------------------------------------------------- */
/* Skin diary                                                                 */
/* -------------------------------------------------------------------------- */

export const SKIN_DIARY_FLAGS = ['breakouts', 'dryness', 'irritation', 'redness'] as const;
export type SkinDiaryFlag = (typeof SKIN_DIARY_FLAGS)[number];

export const SKIN_DIARY_OVERALL_MIN = 1;
export const SKIN_DIARY_OVERALL_MAX = 5;
export const SKIN_DIARY_NOTE_MAX_LENGTH = 500;

/** One day of the user's own skin observations — their words, never a diagnosis. */
export interface SkinDiaryEntryDto {
  /** Opaque calendar date YYYY-MM-DD in the user's local time. */
  date: string;
  overall: number;
  flags: SkinDiaryFlag[];
  note: string | null;
}

export interface SkinDiaryStatsDto {
  loggedDays: number;
  averageOverall: number | null;
  flagCounts: Record<SkinDiaryFlag, number>;
  previousMonthFlagCounts: Record<SkinDiaryFlag, number>;
}

export interface SkinDiaryMonthDto {
  /** YYYY-MM. */
  month: string;
  entries: SkinDiaryEntryDto[];
  stats: SkinDiaryStatsDto;
  /**
   * True when the Free plan trimmed the response to the last few days —
   * month-over-month stats are then zeroed as well.
   */
  historyLimited?: boolean;
}

export interface UpsertSkinDiaryEntryPayload {
  overall: number;
  flags: SkinDiaryFlag[];
  note?: string | null;
}

/* -------------------------------------------------------------------------- */
/* Dupe finder                                                                */
/* -------------------------------------------------------------------------- */

export interface DupeMatchDto {
  product: ProductSummaryDto;
  /** Cosine similarity of the composition fingerprints, 0–100. */
  similarityPercent: number;
  /** Matched ingredients shared within the top of both INCI lists. */
  sharedIngredientCount: number;
  /** Candidate price minus subject price; negative means the dupe is cheaper. */
  priceDifference: number | null;
}

export interface DupeResultDto {
  subject: ProductSummaryDto;
  dupes: DupeMatchDto[];
  /** How many further matches exist beyond the Free ceiling; 0 for Premium. */
  lockedDupeCount?: number;
}

/* -------------------------------------------------------------------------- */
/* App reviews                                                                */
/* -------------------------------------------------------------------------- */

export const APP_REVIEW_SORTS = ['newest', 'oldest', 'rating-desc', 'rating-asc'] as const;
export type AppReviewSort = (typeof APP_REVIEW_SORTS)[number];

export interface AppReviewDto {
  id: string;
  rating: number;
  body: string;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AppReviewSummary {
  /** Rounded to one decimal; null when there are no visible reviews. */
  average: number | null;
  count: number;
  /** Index 0 = 1 star … index 4 = 5 stars. */
  distribution: [number, number, number, number, number];
}

export interface AppReviewListResult extends PaginatedResult<AppReviewDto> {
  summary: AppReviewSummary;
}

export interface CreateAppReviewPayload {
  rating: number;
  body: string;
}

/* -------------------------------------------------------------------------- */
/* AI OUTPUT                                                                  */
/* -------------------------------------------------------------------------- */

export interface AiProductSuggestion {
  role: 'best-match' | 'cheaper' | 'alternative' | 'already-owned';
  /** Overrides the role's default card label — e.g. a routine step name. */
  label: LocalisedText | null;
  reason: LocalisedText | null;
  product: ProductSummaryDto;
}

export interface AiMessageDto {
  id: string;
  role: MessageRole;
  content: string;
  suggestions: AiProductSuggestion[];
  createdAt: string;
}

export interface AiChatRequest {
  message: string;
  conversationId?: string;
  /** Language the answer should be written in. Defaults to English. */
  locale?: 'en' | 'pl';
}

export interface AiChatResponse {
  conversationId: string;
  message: AiMessageDto;
}

export interface AiConversationDto {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  messages: AiMessageDto[];
}

/* -------------------------------------------------------------------------- */
/* Discovery / dashboard                                                      */
/* -------------------------------------------------------------------------- */

export interface DiscoverySectionDto {
  key: string;
  title: string;
  subtitle: string | null;
  products: ProductSummaryDto[];
}

export interface DiscoveryFeedDto {
  sections: DiscoverySectionDto[];
}

export interface DashboardDto {
  user: UserDto;
  profile: BeautyProfileDto | null;
  shelfCount: number;
  favoriteCount: number;
  activeAlerts: number;
  recommended: ProductSummaryDto[];
  routine: RoutineAnalysisDto | null;
  regulatoryAlerts: RegulatoryAlertDto[];
}

/* -------------------------------------------------------------------------- */
/* Admin                                                                      */
/* -------------------------------------------------------------------------- */

export interface AdminStatsDto {
  users: number;
  products: number;
  brands: number;
  categories: number;
  ingredients: number;
  stores: number;
  offers: number;
  shelfItems: number;
  conversations: number;
}

/** Outcome of importing a product's ingredient list from label text. */
export interface LabelImportResultDto {
  total: number;
  matched: number;
  /** Label tokens (as printed) that did not resolve to the dictionary. */
  unmatched: string[];
  /** Position-weighted share of tokens matched with confidence ≥ 0.9. */
  recognizedRatio: number;
  hasMayContainSection: boolean;
}

/** A label token the matcher could not resolve, aggregated across products. */
export interface UnmatchedTokenDto {
  id: string;
  normalized: string;
  rawSamples: string[];
  occurrenceCount: number;
  suggestedIngredient: { id: string; inciName: string } | null;
  suggestedScore: number | null;
  status: TokenStatus;
  resolvedAt: string | null;
  createdAt: string;
}

export type ImportRunStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'INTERRUPTED';

export interface ImportRunDto {
  id: string;
  source: { code: string; name: string };
  status: ImportRunStatus;
  isDryRun: boolean;
  params: Record<string, unknown> | null;
  created: number;
  updated: number;
  skipped: number;
  queued: number;
  failed: number;
  errors: string[];
  startedAt: string;
  finishedAt: string | null;
}

export interface MatchWeightSetDto {
  version: number;
  isActive: boolean;
  weights: MatchWeights;
  note: string | null;
  createdAt: string;
}

export interface AuditLogDto {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  /** `entity.action`, e.g. `products.update`, `inci.map`. */
  action: string;
  entity: string;
  entityId: string | null;
  diff: Record<string, unknown> | null;
  createdAt: string;
}

export interface TokenResolutionDto {
  token: UnmatchedTokenDto;
  rematchedRows: number;
  affectedProducts: number;
}

/**
 * Outcome of a bulk queue action. There is deliberately no product count: the
 * same product can be reached through several tokens, so a total would
 * double-count. Token and row counts are exact.
 */
export interface BulkResolutionDto {
  resolvedTokens: number;
  skippedTokens: number;
  rematchedRows: number;
}
