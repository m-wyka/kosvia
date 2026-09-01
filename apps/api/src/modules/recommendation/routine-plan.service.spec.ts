import { buildWeekPlan, type PlannerItem } from './routine-plan.service';

const item = (overrides: Partial<PlannerItem> = {}): PlannerItem => ({
  productId: 'p1',
  productSlug: 'p1',
  name: 'Product 1',
  step: 'MOISTURIZER',
  tags: [],
  ...overrides,
});

const eveningProductIds = (plan: ReturnType<typeof buildWeekPlan>, day: number): string[] =>
  plan.days[day]!.evening.map((entry) => entry.productId);

describe('buildWeekPlan', () => {
  it('puts SPF in every morning and never in the evening', () => {
    const plan = buildWeekPlan([item({ productId: 'spf', step: 'SPF' })], 'MEDIUM');
    for (const day of plan.days) {
      expect(day.morning.map((entry) => entry.productId)).toContain('spf');
      expect(day.evening.map((entry) => entry.productId)).not.toContain('spf');
    }
  });

  it('keeps retinoid and exfoliant on different evenings', () => {
    const plan = buildWeekPlan(
      [
        item({ productId: 'retinoid', step: 'SERUM', tags: ['retinoid'] }),
        item({ productId: 'acid', step: 'EXFOLIANT', tags: ['exfoliant'] }),
      ],
      'LOW',
    );
    for (let day = 0; day < 7; day += 1) {
      const ids = eveningProductIds(plan, day);
      expect(ids.includes('retinoid') && ids.includes('acid')).toBe(false);
    }
  });

  it('caps exfoliating evenings by sensitivity', () => {
    const exfoliant = item({ productId: 'acid', step: 'EXFOLIANT', tags: ['exfoliant'] });
    const highPlan = buildWeekPlan([exfoliant], 'HIGH');
    const lowPlan = buildWeekPlan([exfoliant], 'LOW');
    const countEvenings = (plan: ReturnType<typeof buildWeekPlan>) =>
      plan.days.filter((day) => day.evening.some((entry) => entry.productId === 'acid')).length;
    expect(countEvenings(highPlan)).toBe(1);
    expect(countEvenings(lowPlan)).toBe(3);
  });

  it('sends body, hair and makeup products to the unscheduled bucket', () => {
    const plan = buildWeekPlan([item({ productId: 'shampoo', step: 'HAIR' })], 'MEDIUM');
    expect(plan.unscheduled.map((entry) => entry.productId)).toEqual(['shampoo']);
    expect(plan.days.every((day) => !day.morning.length && !day.evening.length)).toBe(true);
  });

  it('places a mask once a week on the calmest evening', () => {
    const plan = buildWeekPlan(
      [
        item({ productId: 'retinoid', step: 'SERUM', tags: ['retinoid'] }),
        item({ productId: 'mask', step: 'MASK' }),
      ],
      'MEDIUM',
    );
    const maskEvenings = plan.days.filter((day) =>
      day.evening.some((entry) => entry.productId === 'mask'),
    );
    expect(maskEvenings).toHaveLength(1);
    expect(maskEvenings[0]!.evening.map((entry) => entry.productId)).not.toContain('retinoid');
  });

  it('is deterministic for the same shelf', () => {
    const shelf = [
      item({ productId: 'cleanser', step: 'CLEANSER' }),
      item({ productId: 'spf', step: 'SPF' }),
      item({ productId: 'retinoid', step: 'SERUM', tags: ['retinoid'] }),
    ];
    expect(buildWeekPlan(shelf, 'MEDIUM')).toEqual(buildWeekPlan([...shelf], 'MEDIUM'));
  });

  it('returns an empty plan without notes for an empty shelf', () => {
    const plan = buildWeekPlan([], 'UNKNOWN');
    expect(plan.itemCount).toBe(0);
    expect(plan.notes).toHaveLength(0);
    expect(plan.days).toHaveLength(7);
  });
});
