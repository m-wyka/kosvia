import type { MatchTier } from './api.js';

/** Formats a PLN amount the way the whole product displays money. */
export function formatPrice(value: number | null | undefined, currency = 'PLN'): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toFixed(2).replace('.', ',')} ${currency}`;
}

export function matchTier(score: number): MatchTier {
  if (score >= 90) return 'perfect';
  if (score >= 78) return 'great';
  if (score >= 62) return 'good';
  if (score >= 45) return 'fair';
  return 'poor';
}

export const MATCH_TIER_LABEL: Record<MatchTier, string> = {
  perfect: 'Perfect match',
  great: 'Great match',
  good: 'Good match',
  fair: 'Fair match',
  poor: 'Weak match',
};

/**
 * Price per 100 ml/g, the only fair way to compare cosmetics of different sizes.
 * Returns null when the volume is unknown or expressed in units we can't normalise.
 */
export function pricePerHundred(
  price: number | null,
  volume: number | null,
  unit: string | null,
): number | null {
  if (price === null || volume === null || !volume || unit === 'piece') return null;
  const normalised = unit === 'l' ? volume * 1000 : unit === 'kg' ? volume * 1000 : volume;
  if (!normalised) return null;
  return Math.round((price / normalised) * 100 * 100) / 100;
}

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/gi, 'l')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
