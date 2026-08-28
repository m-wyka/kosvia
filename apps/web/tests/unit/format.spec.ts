import { describe, expect, it } from 'vitest';
import { formatPrice, matchTier, pricePerHundred, slugify } from '@kosvia/shared';

/**
 * The shared formatters decide how money and match tiers read across the whole
 * product, so they are worth pinning down.
 */
describe('formatPrice', () => {
  it('uses the comma decimal separator Polish prices are written with', () => {
    expect(formatPrice(59.99)).toBe('59,99 PLN');
    expect(formatPrice(40)).toBe('40,00 PLN');
  });

  it('shows an em dash rather than “0,00 PLN” when there is no price', () => {
    expect(formatPrice(null)).toBe('—');
    expect(formatPrice(undefined)).toBe('—');
    expect(formatPrice(Number.NaN)).toBe('—');
  });

  it('respects a different currency', () => {
    expect(formatPrice(12.5, 'EUR')).toBe('12,50 EUR');
  });
});

describe('pricePerHundred', () => {
  it('normalises price by volume so different sizes compare fairly', () => {
    expect(pricePerHundred(90, 200, 'ml')).toBe(45);
    expect(pricePerHundred(40, 50, 'ml')).toBe(80);
  });

  it('converts litres and kilograms to the same scale', () => {
    expect(pricePerHundred(50, 1, 'l')).toBe(5);
    expect(pricePerHundred(50, 1, 'kg')).toBe(5);
  });

  it('returns null when it cannot be computed', () => {
    expect(pricePerHundred(null, 50, 'ml')).toBeNull();
    expect(pricePerHundred(50, null, 'ml')).toBeNull();
    expect(pricePerHundred(50, 0, 'ml')).toBeNull();
  });
});

describe('matchTier', () => {
  it('maps scores onto the tiers the UI colours by', () => {
    expect(matchTier(95)).toBe('perfect');
    expect(matchTier(80)).toBe('great');
    expect(matchTier(65)).toBe('good');
    expect(matchTier(50)).toBe('fair');
    expect(matchTier(20)).toBe('poor');
  });

  it('is monotonic across the whole range', () => {
    const order = ['poor', 'fair', 'good', 'great', 'perfect'];
    let lowest = 0;
    for (let score = 0; score <= 100; score += 1) {
      const rank = order.indexOf(matchTier(score));
      expect(rank).toBeGreaterThanOrEqual(lowest);
      lowest = rank;
    }
  });
});

describe('slugify', () => {
  it('produces clean URL slugs, including from Polish characters', () => {
    expect(slugify('CeraVe Moisturizing Cream')).toBe('cerave-moisturizing-cream');
    expect(slugify('Krem Nawilżający Ó 50ml')).toBe('krem-nawilzajacy-o-50ml');
    expect(slugify('  spaced  out  ')).toBe('spaced-out');
  });
});
