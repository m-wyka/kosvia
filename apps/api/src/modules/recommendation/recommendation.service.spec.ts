import { Prisma, type RoutineStep } from '@prisma/client';
import { RecommendationService } from './recommendation.service';
import { PersonalMatchService } from '../scoring/personal-match.service';
import type { CoarseMatchService } from '../scoring/coarse-match.service';
import type { PrismaService } from '../../common/prisma/prisma.service';
import type { ViewerContext } from '../profile/viewer-context.service';
import { row } from './__fixtures__';

const ANON: ViewerContext = { userId: null, profile: null };

/** A tiny catalogue: one cheap and one expensive option per routine step. */
const CATALOGUE: Record<RoutineStep, number[]> = {
  CLEANSER: [20, 40],
  SERUM: [30, 60],
  MOISTURIZER: [25, 50],
  SPF: [64, 90],
} as never;

const rowFor = (step: RoutineStep | undefined, price: number) =>
  row({
    id: `${step ?? 'any'}-${price}`,
    price,
    routineStep: step ?? 'OTHER',
    // Dearer options score better, so the builder has a real
    // incentive to overspend if the allocation lets it.
    ingredientScore: Math.min(95, 40 + price),
  });

/** Pass A stand-in: every candidate survives, in the order given. */
const coarseMatchStub = {
  topCandidates: jest.fn(async (ids: string[]) => ids.map((id) => ({ id, coarse: 0 }))),
} as unknown as CoarseMatchService;

function prismaFor(catalogue: Partial<Record<RoutineStep, number[]>>) {
  const stepOf = (where: Record<string, never>): RoutineStep | undefined =>
    (where?.category as { routineStep?: RoutineStep } | undefined)?.routineStep;

  return {
    product: {
      findMany: jest.fn(async ({ where }: { where: Record<string, never> }) => {
        const wantedIds = (where?.id as { in?: string[] } | undefined)?.in;
        if (wantedIds) {
          return (Object.entries(catalogue) as Array<[RoutineStep, number[]]>)
            .flatMap(([step, prices]) => prices.map((price) => rowFor(step, price)))
            .filter((candidate) => wantedIds.includes(candidate.id));
        }
        const step = stepOf(where);
        const prices = step ? (catalogue[step] ?? []) : Object.values(catalogue).flat();
        const ceiling = (where?.lowestPrice as { lte?: Prisma.Decimal } | undefined)?.lte;
        const max = ceiling ? Number(ceiling.toString()) : Number.POSITIVE_INFINITY;

        return prices.filter((price) => price <= max).map((price) => rowFor(step, price));
      }),
      aggregate: jest.fn(async ({ where }: { where: Record<string, never> }) => {
        const step = stepOf(where);
        const prices = step ? (catalogue[step] ?? []) : [];
        return {
          _min: {
            lowestPrice: prices.length ? new Prisma.Decimal(Math.min(...prices)) : null,
          },
        };
      }),
      findUnique: jest.fn(),
    },
    beautyConcern: { findUnique: jest.fn() },
  } as unknown as PrismaService;
}

describe('RecommendationService.buildRoutine', () => {
  const build = (budget: number, catalogue = CATALOGUE) =>
    new RecommendationService(
      prismaFor(catalogue),
      new PersonalMatchService(),
      coarseMatchStub,
    ).buildRoutine(budget, ANON);

  it('returns the four core steps in the order you apply them', async () => {
    const plan = await build(300);
    expect(plan.steps.map((step) => step.step)).toEqual([
      'CLEANSER',
      'SERUM',
      'MOISTURIZER',
      'SPF',
    ]);
  });

  it.each([80, 100, 139, 150, 200, 400])('never exceeds a %i PLN budget', async (budget) => {
    const plan = await build(budget);
    expect(plan.totalPrice).toBeLessThanOrEqual(budget);
  });

  it('fills every step when the budget covers the cheapest of each', async () => {
    // 20 + 30 + 25 + 64 = 139
    const plan = await build(139);
    expect(plan.steps.every((step) => step.product !== null)).toBe(true);
    expect(plan.notes.join(' ')).not.toMatch(/missing from this plan/i);
  });

  it('drops the treatment serum before sun protection when money is tight', async () => {
    const plan = await build(100);
    const byStep = new Map(plan.steps.map((step) => [step.step, step.product]));

    expect(byStep.get('SPF')).not.toBeNull();
    expect(byStep.get('SERUM')).toBeNull();
  });

  it('keeps sun protection even when it alone eats most of the budget', async () => {
    const plan = await build(70);
    expect(plan.steps.find((step) => step.step === 'SPF')?.product).not.toBeNull();
  });

  it('says what is missing, in application order, and what it would cost to fix', async () => {
    const plan = await build(100);
    const note = plan.notes.find((entry) => entry.code === 'routine-missing');

    expect(note).toBeDefined();
    // The client renders from code + params; `text` stays the canonical English.
    expect(note!.params?.steps).toContain('treatment serum');
    expect(note!.text).toMatch(/Raising the budget by about \d+ PLN/);
  });

  it('offers the leftover as a next step when everything fit', async () => {
    const plan = await build(400);
    expect(plan.notes.some((note) => note.code === 'routine-leftover')).toBe(true);
  });

  it('spends more of a larger budget rather than always buying the cheapest', async () => {
    const tight = await build(139);
    const generous = await build(400);
    expect(generous.totalPrice).toBeGreaterThan(tight.totalPrice);
  });

  it('handles a step the catalogue cannot serve at all', async () => {
    const plan = await build(300, { ...CATALOGUE, SERUM: [] });
    const serum = plan.steps.find((step) => step.step === 'SERUM')!;

    expect(serum.product).toBeNull();
    expect(serum.reason.code).toBe('routine-step-absent');
    expect(serum.reason.text).toMatch(/do not have a treatment serum/i);
    // The rest of the routine is still built.
    expect(plan.steps.filter((step) => step.product).length).toBe(3);
  });

  it('reports the average match across the steps it actually filled', async () => {
    const plan = await build(300);
    const scores = plan.steps
      .map((step) => step.product?.personalMatch?.score)
      .filter((score): score is number => typeof score === 'number');

    expect(plan.averageMatch).toBe(
      Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length),
    );
  });
});
