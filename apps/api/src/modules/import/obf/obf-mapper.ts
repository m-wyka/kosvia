import { mapObfCategory } from './obf-category-map';
import type { OpenBeautyFactsProduct } from './obf-types';

export interface NormalizedProduct {
  ean: string;
  name: string;
  brandName: string;
  categorySlug: string;
  rawLabel: string;
  imageUrl: string | null;
  volume: number | null;
  volumeUnit: string | null;
  sourceUpdatedAt: Date | null;
}

export type SkipReason =
  'invalid-ean' | 'missing-name' | 'missing-brand' | 'missing-ingredients' | 'unmapped-category';

export type MappedRecord =
  | { kind: 'product'; product: NormalizedProduct }
  | { kind: 'skip'; reason: SkipReason; ean: string | null };

const EAN_PATTERN = /^\d{8,14}$/;
const QUANTITY_PATTERN = /(\d+(?:[.,]\d+)?)\s*(ml|g|l|kg|oz|fl\s*oz)\b/i;
const MIN_LABEL_LENGTH = 12;
/** How much of the label's start we look for again to detect a doubled paste. */
const REPEAT_PROBE_LENGTH = 24;
const MILLILITRES_PER_LITRE = 1000;
const GRAMS_PER_KILOGRAM = 1000;

const firstNonEmpty = (...values: Array<string | undefined>): string | null => {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return null;
};

/**
 * Community labels are sometimes pasted twice, often mid-token
 * ("…C12-15 AlkylAqua (Water), Octocrylene…"). When the opening of the label
 * shows up again later, the later copy is the complete one.
 */
export const dedupeRepeatedLabel = (label: string): string => {
  const probe = label.slice(0, REPEAT_PROBE_LENGTH);
  if (probe.length < REPEAT_PROBE_LENGTH) {
    return label;
  }
  const repeatAt = label.indexOf(probe, 1);
  return repeatAt > 0 ? label.slice(repeatAt) : label;
};

export const parseQuantity = (
  quantity: string | undefined,
): { volume: number | null; volumeUnit: string | null } => {
  const match = quantity ? QUANTITY_PATTERN.exec(quantity) : null;
  if (!match) {
    return { volume: null, volumeUnit: null };
  }
  const amount = Number(match[1].replace(',', '.'));
  const unit = match[2].toLowerCase().replace(/\s+/g, '');
  if (unit === 'l') {
    return { volume: amount * MILLILITRES_PER_LITRE, volumeUnit: 'ml' };
  }
  if (unit === 'kg') {
    return { volume: amount * GRAMS_PER_KILOGRAM, volumeUnit: 'g' };
  }
  if (unit === 'floz') {
    return { volume: amount, volumeUnit: 'fl oz' };
  }
  return { volume: amount, volumeUnit: unit };
};

export const primaryBrand = (brands: string | undefined): string | null =>
  firstNonEmpty(brands?.split(',')[0]);

export const mapObfProduct = (raw: OpenBeautyFactsProduct): MappedRecord => {
  const ean = raw.code?.trim() ?? null;
  if (!ean || !EAN_PATTERN.test(ean)) {
    return { kind: 'skip', reason: 'invalid-ean', ean };
  }
  const name = firstNonEmpty(raw.product_name_pl, raw.product_name, raw.product_name_en);
  if (!name) {
    return { kind: 'skip', reason: 'missing-name', ean };
  }
  const brandName = primaryBrand(raw.brands);
  if (!brandName) {
    return { kind: 'skip', reason: 'missing-brand', ean };
  }
  const label = firstNonEmpty(
    raw.ingredients_text_pl,
    raw.ingredients_text,
    raw.ingredients_text_en,
  );
  if (!label || label.length < MIN_LABEL_LENGTH) {
    return { kind: 'skip', reason: 'missing-ingredients', ean };
  }
  const categorySlug = mapObfCategory(raw.categories_tags ?? []);
  if (!categorySlug) {
    return { kind: 'skip', reason: 'unmapped-category', ean };
  }
  const { volume, volumeUnit } = parseQuantity(raw.quantity);
  return {
    kind: 'product',
    product: {
      ean,
      name,
      brandName,
      categorySlug,
      rawLabel: dedupeRepeatedLabel(label),
      imageUrl: firstNonEmpty(raw.image_url),
      volume,
      volumeUnit,
      sourceUpdatedAt: raw.last_modified_t ? new Date(raw.last_modified_t * 1000) : null,
    },
  };
};
