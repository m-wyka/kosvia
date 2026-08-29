import { INGREDIENT_TAGS, SKIN_TYPES, type IngredientTag, type SkinType } from '@kosvia/shared';
import { clamp, positionWeight, type ScorableProductIngredient } from './types';

/**
 * Bump when the formula below changes so stale rows can be found and
 * recomputed selectively (`WHERE "traitsVersion" < TRAITS_VERSION`).
 */
export const TRAITS_VERSION = 1;

export const FINGERPRINT_DIMENSIONS = 64;
const TAG_DIMENSIONS = INGREDIENT_TAGS.length;
const ACTIVE_BUCKETS = FINGERPRINT_DIMENSIONS - TAG_DIMENSIONS;
const MAY_CONTAIN_WEIGHT = 0.1;
const RECOGNIZED_THRESHOLD = 0.9;
/** Reference load at which a functional score saturates to 1. */
const FUNCTIONAL_SATURATION = 1.5;
/** Position-weight sum of a fully covered 12-ingredient head; skin fit is a share of it. */
const SKIN_FIT_HEAD_LENGTH = 12;

const ALCOHOL_DENAT_NAMES = new Set(['alcohol denat', 'alcohol', 'ethanol', 'sd alcohol 40-b']);
const ESSENTIAL_OIL_PATTERN = /\b(oil|leaf oil|flower oil|peel oil|seed oil extract)\b/;
const ESSENTIAL_OIL_HINTS =
  /(lavandula|citrus|mentha|eucalyptus|rosmarinus|melaleuca|cananga|pelargonium|santalum|cymbopogon|thymus|origanum|salvia)/;
const SILICONE_PATTERN = /(dimethicone|siloxane|silsesquioxane|methicone|silicone)/;

export interface TraitsInput {
  ingredients: Array<
    ScorableProductIngredient & {
      isAfterMayContain?: boolean;
      matchConfidence?: number;
      normalizedName?: string;
    }
  >;
  /** Total label rows including unmatched ones, for completeness metrics. */
  labelRowCount?: number;
  isFragranceFree: boolean;
}

export interface ComputedTraits {
  hasFragrance: boolean;
  hasFragranceAllergen: boolean;
  hasAlcoholDenat: boolean;
  alcoholDenatPosition: number | null;
  hasEssentialOils: boolean;
  hasSilicones: boolean;
  hasSpf: boolean;
  humectantScore: number;
  emollientScore: number;
  occlusiveScore: number;
  antioxidantScore: number;
  exfoliantScore: number;
  soothingScore: number;
  brighteningScore: number;
  antiAgingScore: number;
  sebumRegulationScore: number;
  skinFitDry: number;
  skinFitOily: number;
  skinFitCombination: number;
  skinFitNormal: number;
  skinFitSensitive: number;
  calmingLoad: number;
  irritantLoad: number;
  activeIngredientIds: string[];
  concernSlugs: string[];
  goalSlugs: string[];
  fingerprint: number[];
  ingredientCount: number;
  recognizedRatio: number;
  dataCompleteness: number;
  traitsVersion: number;
}

const SKIN_FIT_KEYS: Record<Exclude<SkinType, 'UNKNOWN'>, keyof ComputedTraits> = {
  DRY: 'skinFitDry',
  OILY: 'skinFitOily',
  COMBINATION: 'skinFitCombination',
  NORMAL: 'skinFitNormal',
  SENSITIVE: 'skinFitSensitive',
};

const FUNCTIONAL_TAGS: Record<string, IngredientTag[]> = {
  humectantScore: ['humectant'],
  emollientScore: ['emollient'],
  occlusiveScore: ['occlusive'],
  antioxidantScore: ['antioxidant'],
  exfoliantScore: ['exfoliant'],
  soothingScore: ['soothing', 'barrier-support'],
  brighteningScore: ['brightening'],
  antiAgingScore: ['retinoid', 'peptide', 'antioxidant'],
  sebumRegulationScore: ['sebum-regulating'],
};

/** Deterministic string hash (FNV-1a) so the same active always lands in the same bucket. */
export const hashToBucket = (value: string, buckets: number): number => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % buckets;
};

const entryWeight = (entry: TraitsInput['ingredients'][number]): number =>
  positionWeight(entry.position) * (entry.isAfterMayContain ? MAY_CONTAIN_WEIGHT : 1);

const saturate = (load: number): number => clamp(load / FUNCTIONAL_SATURATION, 0, 1);

const normalizeVector = (vector: number[]): number[] => {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return magnitude === 0 ? vector : vector.map((value) => value / magnitude);
};

export const computeTraits = (input: TraitsInput): ComputedTraits => {
  const entries = input.ingredients;
  const tagLoad = new Map<IngredientTag, number>();
  const skinFitHits = new Map<SkinType, number>();
  const fingerprint = new Array<number>(FINGERPRINT_DIMENSIONS).fill(0);
  const concernSlugs = new Set<string>();
  const goalSlugs = new Set<string>();
  const activeIngredientIds = new Set<string>();

  let calmingLoad = 0;
  let irritantLoad = 0;
  let headWeight = 0;
  let alcoholDenatPosition: number | null = null;
  let hasEssentialOils = false;
  let hasSilicones = false;

  for (const entry of entries) {
    const weight = entryWeight(entry);
    const { ingredient } = entry;
    const name = (entry.normalizedName ?? ingredient.inciName).toLowerCase();

    for (const tag of ingredient.tags as IngredientTag[]) {
      tagLoad.set(tag, (tagLoad.get(tag) ?? 0) + weight);
      const tagIndex = INGREDIENT_TAGS.indexOf(tag);
      if (tagIndex >= 0) {
        fingerprint[tagIndex] += weight;
      }
    }
    if (ingredient.isActiveIngredient) {
      activeIngredientIds.add(ingredient.id);
      fingerprint[TAG_DIMENSIONS + hashToBucket(ingredient.id, ACTIVE_BUCKETS)] += weight;
    }
    for (const slug of ingredient.targetsConcerns) {
      concernSlugs.add(slug);
    }
    for (const slug of ingredient.supportsGoals) {
      goalSlugs.add(slug);
    }
    if (ingredient.sensitivityImpact < 0) {
      irritantLoad += -ingredient.sensitivityImpact * positionWeight(entry.position);
    } else if (ingredient.sensitivityImpact > 0) {
      calmingLoad += ingredient.sensitivityImpact * positionWeight(entry.position);
    }
    if (entry.position <= SKIN_FIT_HEAD_LENGTH) {
      headWeight += positionWeight(entry.position);
      for (const skinType of ingredient.goodForSkinTypes) {
        skinFitHits.set(
          skinType,
          (skinFitHits.get(skinType) ?? 0) + positionWeight(entry.position),
        );
      }
    }
    if (alcoholDenatPosition === null && ALCOHOL_DENAT_NAMES.has(name)) {
      alcoholDenatPosition = entry.position;
    }
    if (ESSENTIAL_OIL_HINTS.test(name) && ESSENTIAL_OIL_PATTERN.test(name)) {
      hasEssentialOils = true;
    }
    if (SILICONE_PATTERN.test(name)) {
      hasSilicones = true;
    }
  }

  const functional = Object.fromEntries(
    Object.entries(FUNCTIONAL_TAGS).map(([key, tags]) => [
      key,
      saturate(tags.reduce((sum, tag) => sum + (tagLoad.get(tag) ?? 0), 0)),
    ]),
  ) as Pick<
    ComputedTraits,
    | 'humectantScore'
    | 'emollientScore'
    | 'occlusiveScore'
    | 'antioxidantScore'
    | 'exfoliantScore'
    | 'soothingScore'
    | 'brighteningScore'
    | 'antiAgingScore'
    | 'sebumRegulationScore'
  >;

  const skinFit = Object.fromEntries(
    SKIN_TYPES.filter((type): type is Exclude<SkinType, 'UNKNOWN'> => type !== 'UNKNOWN').map(
      (type) => [
        SKIN_FIT_KEYS[type],
        headWeight ? clamp((skinFitHits.get(type) ?? 0) / headWeight, 0, 1) : 0,
      ],
    ),
  ) as Pick<
    ComputedTraits,
    'skinFitDry' | 'skinFitOily' | 'skinFitCombination' | 'skinFitNormal' | 'skinFitSensitive'
  >;

  const labelRowCount = input.labelRowCount ?? entries.length;
  const recognizedRatio = recognizedShare(entries, labelRowCount);
  const hasFragrance = !input.isFragranceFree || (tagLoad.get('fragrance') ?? 0) > 0;

  return {
    hasFragrance,
    hasFragranceAllergen: hasFragrance,
    hasAlcoholDenat: alcoholDenatPosition !== null,
    alcoholDenatPosition,
    hasEssentialOils,
    hasSilicones,
    hasSpf: (tagLoad.get('uv-filter') ?? 0) > 0,
    ...functional,
    ...skinFit,
    calmingLoad,
    irritantLoad,
    activeIngredientIds: [...activeIngredientIds],
    concernSlugs: [...concernSlugs],
    goalSlugs: [...goalSlugs],
    fingerprint: normalizeVector(fingerprint),
    ingredientCount: labelRowCount,
    recognizedRatio,
    dataCompleteness: Number((labelRowCount === 0 ? 0 : 0.5 + 0.5 * recognizedRatio).toFixed(3)),
    traitsVersion: TRAITS_VERSION,
  };
};

/** Position-weighted share of label rows matched with confidence ≥ 0.9. */
const recognizedShare = (entries: TraitsInput['ingredients'], labelRowCount: number): number => {
  if (labelRowCount === 0) {
    return 0;
  }
  let weighted = 0;
  let total = 0;
  for (let position = 1; position <= labelRowCount; position += 1) {
    total += positionWeight(position);
  }
  for (const entry of entries) {
    if ((entry.matchConfidence ?? 1) >= RECOGNIZED_THRESHOLD) {
      weighted += entryWeight(entry);
    }
  }
  return Number(clamp(weighted / total, 0, 1).toFixed(3));
};
