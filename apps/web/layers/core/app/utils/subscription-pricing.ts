import type { SubscriptionPlanDto } from '@kosvia/shared';

export const minorToMajor = (priceMinor: number): number => priceMinor / 100;

export const yearlySavingsMinor = (monthlyMinor: number, yearlyMinor: number): number =>
  Math.max(0, monthlyMinor * 12 - yearlyMinor);

export const yearlySavingsPercent = (monthlyMinor: number, yearlyMinor: number): number => {
  const fullYearMinor = monthlyMinor * 12;
  if (fullYearMinor <= 0) {
    return 0;
  }
  return Math.round((yearlySavingsMinor(monthlyMinor, yearlyMinor) / fullYearMinor) * 100);
};

export const yearlyMonthlyEquivalentMinor = (yearlyMinor: number): number =>
  Math.round(yearlyMinor / 12);

export const planByPeriod = (
  plans: SubscriptionPlanDto[] | null | undefined,
  period: SubscriptionPlanDto['period'],
): SubscriptionPlanDto | null => plans?.find((plan) => plan.period === period) ?? null;
