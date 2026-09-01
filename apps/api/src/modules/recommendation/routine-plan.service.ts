import { Injectable } from '@nestjs/common';
import type { RoutineStep, SensitivityLevel } from '@prisma/client';
import type {
  LocalisedText,
  RoutinePlanAssignmentDto,
  RoutinePlanDayDto,
  RoutinePlanDto,
} from '@kosvia/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PRODUCT_INCLUDE, hasMatchedIngredient } from '../products/product.select';

const DAYS_IN_WEEK = 7;
const RETINOID_EVENINGS = [0, 2, 4];
const EXFOLIANT_EVENING_POOL = [1, 3, 5, 6];
const EXFOLIANT_EVENINGS_BY_SENSITIVITY: Record<SensitivityLevel, number> = {
  LOW: 3,
  MEDIUM: 2,
  HIGH: 1,
  UNKNOWN: 2,
};
const MEANINGFUL_TAG_POSITION = 8;
const UNSCHEDULED_STEPS: RoutineStep[] = ['BODY', 'HAIR', 'MAKEUP', 'OTHER'];
const DAILY_BOTH_STEPS: RoutineStep[] = ['CLEANSER', 'TONER', 'MOISTURIZER'];
const STEP_ORDER: RoutineStep[] = [
  'CLEANSER',
  'TONER',
  'EXFOLIANT',
  'SERUM',
  'EYE',
  'MOISTURIZER',
  'SPF',
  'MASK',
  'TREATMENT',
  'BODY',
  'HAIR',
  'MAKEUP',
  'OTHER',
];

export interface PlannerItem {
  productId: string;
  productSlug: string;
  name: string;
  step: RoutineStep;
  tags: string[];
}

/**
 * The plan describes how these products are usually spread over a week; the
 * wording must always read as observation ("retinoids are usually used in the
 * evening"), never as instruction — same contract as RoutineAnalysisService.
 */
export const buildWeekPlan = (
  items: PlannerItem[],
  sensitivity: SensitivityLevel,
): RoutinePlanDto => {
  const days: RoutinePlanDayDto[] = Array.from({ length: DAYS_IN_WEEK }, (unused, day) => ({
    day,
    morning: [],
    evening: [],
  }));
  const unscheduled: RoutinePlanAssignmentDto[] = [];
  const notes: LocalisedText[] = [];

  const assignment = (item: PlannerItem, reason: LocalisedText): RoutinePlanAssignmentDto => ({
    productId: item.productId,
    productSlug: item.productSlug,
    productName: item.name,
    step: item.step,
    reason,
  });

  const retinoids = items.filter((item) => item.tags.includes('retinoid'));
  const exfoliants = items.filter(
    (item) =>
      !item.tags.includes('retinoid') &&
      (item.step === 'EXFOLIANT' || item.tags.includes('exfoliant')),
  );
  const masks = items.filter((item) => item.step === 'MASK' && !exfoliants.includes(item));

  for (const item of items) {
    if (UNSCHEDULED_STEPS.includes(item.step)) {
      unscheduled.push(
        assignment(item, {
          code: 'plan-unscheduled',
          text: 'Used as needed rather than on a fixed schedule',
        }),
      );
      continue;
    }
    if (retinoids.includes(item) || exfoliants.includes(item) || masks.includes(item)) {
      continue;
    }
    if (item.step === 'SPF') {
      const reason: LocalisedText = {
        code: 'plan-spf-morning',
        text: 'Sun protection belongs to the morning routine',
      };
      for (const day of days) {
        day.morning.push(assignment(item, reason));
      }
      continue;
    }
    if (DAILY_BOTH_STEPS.includes(item.step)) {
      const reason: LocalisedText = {
        code: 'plan-daily-both',
        text: 'A daily staple, morning and evening',
      };
      for (const day of days) {
        day.morning.push(assignment(item, reason));
        day.evening.push(assignment(item, reason));
      }
      continue;
    }
    if (item.tags.includes('uv-filter')) {
      const reason: LocalisedText = {
        code: 'plan-active-slot',
        text: 'Works best in the morning, under sun exposure',
      };
      for (const day of days) {
        day.morning.push(assignment(item, reason));
      }
      continue;
    }
    const reason: LocalisedText = {
      code: 'plan-supporting-both',
      text: 'Fits both the morning and the evening routine',
    };
    for (const day of days) {
      day.morning.push(assignment(item, reason));
      day.evening.push(assignment(item, reason));
    }
  }

  if (retinoids.length) {
    const reason: LocalisedText = {
      code: 'plan-retinoid-evening',
      text: 'Retinoids are usually used in the evening, with rest days in between',
    };
    RETINOID_EVENINGS.forEach((day, eveningIndex) => {
      days[day]!.evening.push(assignment(retinoids[eveningIndex % retinoids.length]!, reason));
    });
  }

  if (exfoliants.length) {
    const eveningsPerWeek = EXFOLIANT_EVENINGS_BY_SENSITIVITY[sensitivity];
    const reason: LocalisedText = {
      code: 'plan-exfoliant-spacing',
      text: 'Exfoliating products are usually spaced out, away from retinoid evenings',
    };
    EXFOLIANT_EVENING_POOL.slice(0, eveningsPerWeek).forEach((day, eveningIndex) => {
      days[day]!.evening.push(assignment(exfoliants[eveningIndex % exfoliants.length]!, reason));
    });
    notes.push({
      code: 'plan-note-sensitivity',
      text: `Spaced to at most ${eveningsPerWeek} exfoliating evenings a week for your skin sensitivity`,
      params: { count: eveningsPerWeek },
    });
  }

  for (const mask of masks) {
    const emptiestDay = [...days].sort(
      (first, second) => first.evening.length - second.evening.length,
    )[0]!;
    emptiestDay.evening.push(
      assignment(mask, {
        code: 'plan-mask-weekly',
        text: 'A weekly treat, on the calmest evening',
      }),
    );
  }

  const slotOrder = (first: RoutinePlanAssignmentDto, second: RoutinePlanAssignmentDto) => {
    const stepDelta =
      STEP_ORDER.indexOf(first.step as RoutineStep) -
      STEP_ORDER.indexOf(second.step as RoutineStep);
    return stepDelta !== 0 ? stepDelta : first.productName.localeCompare(second.productName);
  };
  for (const day of days) {
    day.morning.sort(slotOrder);
    day.evening.sort(slotOrder);
  }

  if (items.length) {
    notes.push({
      code: 'plan-note-disclaimer',
      text: 'A descriptive suggestion based on typical usage, not a medical or dermatological recommendation',
    });
  }

  return { itemCount: items.length, days, unscheduled, notes };
};

@Injectable()
export class RoutinePlanService {
  constructor(private readonly prisma: PrismaService) {}

  async plan(userId: string): Promise<RoutinePlanDto> {
    const [items, profile] = await Promise.all([
      this.prisma.userShelfItem.findMany({
        where: { userId, finishedAt: null },
        include: { product: { include: PRODUCT_INCLUDE } },
        orderBy: { addedAt: 'desc' },
      }),
      this.prisma.beautyProfile.findUnique({
        where: { userId },
        select: { sensitivity: true },
      }),
    ]);

    const plannerItems: PlannerItem[] = items.map((item) => ({
      productId: item.product.id,
      productSlug: item.product.slug,
      name: item.product.name,
      step: item.product.category.routineStep,
      tags: [
        ...new Set(
          item.product.ingredients
            .filter(hasMatchedIngredient)
            .filter((entry) => entry.position <= MEANINGFUL_TAG_POSITION)
            .flatMap((entry) => entry.ingredient.tags),
        ),
      ],
    }));

    return buildWeekPlan(plannerItems, profile?.sensitivity ?? 'UNKNOWN');
  }
}
