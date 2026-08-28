import type {
  Availability,
  BudgetTier,
  FragrancePreference,
  IngredientTag,
  MessageRole,
  SensitivityLevel,
  SkinType,
  SubscriptionStatus,
  UserRole,
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
  path?: string;
  timestamp?: string;
}

/* -------------------------------------------------------------------------- */
/* Auth & user                                                                */
/* -------------------------------------------------------------------------- */

export interface UserDto {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  subscriptionStatus: SubscriptionStatus;
  hasBeautyProfile: boolean;
  createdAt: string;
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
  excludedIngredients: IngredientSummaryDto[];
  updatedAt: string;
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
  excludedIngredientIds?: string[];
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

export interface ProductOfferDto {
  id: string;
  price: number;
  currency: string;
  url: string | null;
  availability: Availability;
  lastCheckedAt: string;
  store: StoreDto;
}

export interface ProductSummaryDto {
  id: string;
  ean: string | null;
  name: string;
  slug: string;
  imageUrl: string | null;
  volume: number | null;
  volumeUnit: string | null;
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

export interface ProductDto extends ProductSummaryDto {
  description: string | null;
  usage: string | null;
  highlights: string[];
  ingredients: ProductIngredientDto[];
  offers: ProductOfferDto[];
  pricePerHundredMl: number | null;
}

/* -------------------------------------------------------------------------- */
/* Search                                                                     */
/* -------------------------------------------------------------------------- */

export type ProductSort =
  | 'recommended'
  | 'price-asc'
  | 'price-desc'
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
  sort?: ProductSort;
  page?: number;
  pageSize?: number;
}

export interface ProductFacetsDto {
  brands: Array<BrandSummaryDto & { count: number }>;
  categories: Array<{ id: string; name: string; slug: string; count: number }>;
  priceRange: { min: number; max: number };
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
}

export interface IngredientScoreBreakdownDto {
  score: number;
  activeCount: number;
  supportiveCount: number;
  potentialIrritantCount: number;
  notes: LocalisedText[];
}

export type AlternativeKind =
  | 'cheaper'
  | 'better-match'
  | 'better-value'
  | 'similar-ingredients'
  | 'similar-purpose';

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
  product: ProductSummaryDto;
}

export interface RoutineObservationDto {
  kind: 'overlap' | 'gap' | 'ingredient-overlap' | 'balance';
  severity: 'info' | 'notice';
  title: LocalisedText;
  detail: LocalisedText;
  productIds: string[];
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
