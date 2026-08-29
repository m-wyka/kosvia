import { Injectable } from '@nestjs/common';
import type { RoutineStep } from '@prisma/client';
import type { LocalisedText, RoutineAnalysisDto, RoutineObservationDto } from '@kosvia/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PRODUCT_INCLUDE } from '../products/product.select';

/**
 * Routine analysis for My Shelf.
 *
 * Deliberately descriptive, never prescriptive. Kosvia is not a medical
 * product: we say "these two do the same job", never "stop using this".
 */

const ESSENTIAL_STEPS: Array<{
  step: RoutineStep;
  slug: string;
  name: string;
  why: LocalisedText;
}> = [
  {
    step: 'CLEANSER',
    slug: 'cleansers',
    name: 'Cleanser',
    why: { code: 'gap-cleanser', text: 'Every routine starts with removing the day.' },
  },
  {
    step: 'MOISTURIZER',
    slug: 'moisturizers',
    name: 'Moisturiser',
    why: { code: 'gap-moisturizer', text: 'Holds hydration in place after everything else.' },
  },
  {
    step: 'SPF',
    slug: 'sun-care',
    name: 'Sun protection',
    why: { code: 'gap-spf', text: 'The step with the clearest long-term effect on skin.' },
  },
];

@Injectable()
export class RoutineAnalysisService {
  constructor(private readonly prisma: PrismaService) {}

  async analyse(userId: string): Promise<RoutineAnalysisDto> {
    const items = await this.prisma.userShelfItem.findMany({
      where: { userId, finishedAt: null },
      include: { product: { include: PRODUCT_INCLUDE } },
      orderBy: { addedAt: 'desc' },
    });

    const observations: RoutineObservationDto[] = [];
    const byStep = new Map<RoutineStep, typeof items>();
    for (const item of items) {
      const step = item.product.category.routineStep;
      byStep.set(step, [...(byStep.get(step) ?? []), item]);
    }

    /* ------------------------------------------------ overlapping purposes -- */
    for (const [step, group] of byStep) {
      if (group.length < 2 || step === 'OTHER') continue;
      const names = group.map((item) => `${item.product.brand.name} ${item.product.name}`);
      observations.push({
        kind: 'overlap',
        severity: 'info',
        title: {
          code: 'routine-overlap-title',
          text: `${group.length} products doing the same job`,
          params: { count: group.length },
        },
        detail: {
          code: 'routine-overlap-detail',
          text: `${names.join(', ')} all sit at the same step of a routine. That is completely fine if you rotate them — worth knowing if you thought they were doing different things.`,
          params: { products: names.join(', ') },
        },
        productIds: group.map((item) => item.productId),
      });
    }

    /* ------------------------------------------------- ingredient overlap --- */
    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        const a = items[i].product;
        const b = items[j].product;
        const setA = new Set(
          a.ingredients.filter((x) => x.position <= 10).map((x) => x.ingredientId),
        );
        const setB = new Set(
          b.ingredients.filter((x) => x.position <= 10).map((x) => x.ingredientId),
        );
        if (!setA.size || !setB.size) continue;
        let shared = 0;
        for (const id of setB) if (setA.has(id)) shared += 1;
        const jaccard = shared / (setA.size + setB.size - shared);
        if (jaccard >= 0.62) {
          const first = `${a.brand.name} ${a.name}`;
          const second = `${b.brand.name} ${b.name}`;
          observations.push({
            kind: 'ingredient-overlap',
            severity: 'info',
            title: { code: 'routine-duplicate-title', text: 'Nearly identical formulas' },
            detail: {
              code: 'routine-duplicate-detail',
              text: `${first} and ${second} share most of their key ingredients. If you are replacing one, you probably do not need both.`,
              params: { first, second },
            },
            productIds: [a.id, b.id],
          });
        }
      }
    }

    /* -------------------------------------------------------- active load --- */
    const activeProducts = items.filter((item) =>
      item.product.ingredients.some(
        (entry) => entry.ingredient.isActiveIngredient && entry.position <= 8,
      ),
    );
    const exfoliantOrRetinoid = items.filter((item) =>
      item.product.ingredients.some(
        (entry) =>
          entry.position <= 8 &&
          (entry.ingredient.tags.includes('exfoliant') ||
            entry.ingredient.tags.includes('retinoid')),
      ),
    );
    if (exfoliantOrRetinoid.length >= 3) {
      observations.push({
        kind: 'balance',
        severity: 'notice',
        title: { code: 'routine-actives-title', text: 'Several strong actives on one shelf' },
        detail: {
          code: 'routine-actives-detail',
          text: `${exfoliantOrRetinoid.length} of your products contain an exfoliating acid or a retinoid high in the ingredient list. Many people space these across different evenings rather than layering them.`,
          params: { count: exfoliantOrRetinoid.length },
        },
        productIds: exfoliantOrRetinoid.map((item) => item.productId),
      });
    } else if (activeProducts.length === 0 && items.length >= 3) {
      observations.push({
        kind: 'balance',
        severity: 'info',
        title: { code: 'routine-gentle-title', text: 'A gentle, supportive shelf' },
        detail: {
          code: 'routine-gentle-detail',
          text: 'Nothing here is a strong treatment product — it is all cleansing, hydrating and protecting. That is a solid base if you are happy with how your skin looks.',
        },
        productIds: [],
      });
    }

    /* ------------------------------------------------------------- gaps ----- */
    const coveredSteps = new Set(byStep.keys());
    const missing = ESSENTIAL_STEPS.filter((entry) => !coveredSteps.has(entry.step)).map(
      (entry) => ({
        slug: entry.slug,
        name: entry.name,
        why: entry.why,
      }),
    );
    for (const gap of missing) {
      observations.push({
        kind: 'gap',
        severity: 'info',
        title: {
          code: 'routine-gap-title',
          text: `No ${gap.name.toLowerCase()} on your shelf`,
          // The category slug lets a client name the step in its own language.
          params: { category: gap.slug },
        },
        detail: gap.why,
        productIds: [],
      });
    }

    return {
      itemCount: items.length,
      coveredCategories: [...new Set(items.map((item) => item.product.category.name))],
      missingCategories: missing,
      observations,
    };
  }
}
