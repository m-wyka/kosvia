import { describe, expect, it } from 'vitest';
import {
  minorToMajor,
  planByPeriod,
  yearlyMonthlyEquivalentMinor,
  yearlySavingsMinor,
  yearlySavingsPercent,
} from '@@/layers/core/app/utils/subscription-pricing';
import type { SubscriptionPlanDto } from '@kosvia/shared';

const plans: SubscriptionPlanDto[] = [
  { period: 'MONTHLY', priceMinor: 1999, currency: 'PLN', isActive: true, updatedAt: null },
  { period: 'YEARLY', priceMinor: 14999, currency: 'PLN', isActive: true, updatedAt: null },
];

describe('subscription pricing helpers', () => {
  it('converts minor units to major', () => {
    expect(minorToMajor(1999)).toBe(19.99);
  });

  it('computes the yearly savings from live prices, never a hardcoded amount', () => {
    expect(yearlySavingsMinor(1999, 14999)).toBe(1999 * 12 - 14999);
    expect(yearlySavingsPercent(1999, 14999)).toBe(37);
  });

  it('recomputes savings when the admin changes a price', () => {
    expect(yearlySavingsPercent(2999, 14999)).toBe(58);
    expect(yearlySavingsPercent(1000, 12000)).toBe(0);
  });

  it('never reports negative savings', () => {
    expect(yearlySavingsMinor(1000, 99999)).toBe(0);
  });

  it('derives the monthly equivalent of the yearly price', () => {
    expect(yearlyMonthlyEquivalentMinor(14999)).toBe(1250);
  });

  it('finds a plan by period and tolerates missing data', () => {
    expect(planByPeriod(plans, 'YEARLY')?.priceMinor).toBe(14999);
    expect(planByPeriod(null, 'MONTHLY')).toBeNull();
  });
});
