import { Injectable } from '@nestjs/common';
import type { RoutineStep } from '@prisma/client';
import type { RoutineAnalysisDto, RoutineObservationDto } from '@kosvia/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PRODUCT_INCLUDE } from '../products/product.select';

/**
 * Routine analysis for My Shelf.
 *
 * Deliberately descriptive, never prescriptive. Kosvia is not a medical
 * product: we say "these two do the same job", never "stop using this".
 */

const ESSENTIAL_STEPS: Array<{ step: RoutineStep; slug: string; name: string; why: string }> = [
  { step: 'CLEANSER', slug: 'cleansers', name: 'Cleanser', why: 'Every routine starts with removing the day.' },
  { step: 'MOISTURIZER', slug: 'moisturizers', name: 'Moisturiser', why: 'Holds hydration in place after everything else.' },
  { step: 'SPF', slug: 'sun-care', name: 'Sun protection', why: 'The step with the clearest long-term effect on skin.' },
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
      observations.push({
        kind: 'overlap',
        severity: 'info',
        title: `${group.length} products doing the same job`,
        detail: `${group
          .map((item) => `${item.product.brand.name} ${item.product.name}`)
          .join(', ')} all sit at the same step of a routine. That is completely fine if you rotate them — worth knowing if you thought they were doing different things.`,
        productIds: group.map((item) => item.productId),
      });
    }

    /* ------------------------------------------------- ingredient overlap --- */
    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        const a = items[i].product;
        const b = items[j].product;
        const setA = new Set(a.ingredients.filter((x) => x.position <= 10).map((x) => x.ingredientId));
        const setB = new Set(b.ingredients.filter((x) => x.position <= 10).map((x) => x.ingredientId));
        if (!setA.size || !setB.size) continue;
        let shared = 0;
        for (const id of setB) if (setA.has(id)) shared += 1;
        const jaccard = shared / (setA.size + setB.size - shared);
        if (jaccard >= 0.62) {
          observations.push({
            kind: 'ingredient-overlap',
            severity: 'info',
            title: 'Nearly identical formulas',
            detail: `${a.brand.name} ${a.name} and ${b.brand.name} ${b.name} share most of their key ingredients. If you are replacing one, you probably do not need both.`,
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
          (entry.ingredient.tags.includes('exfoliant') || entry.ingredient.tags.includes('retinoid')),
      ),
    );
    if (exfoliantOrRetinoid.length >= 3) {
      observations.push({
        kind: 'balance',
        severity: 'notice',
        title: 'Several strong actives on one shelf',
        detail: `${exfoliantOrRetinoid.length} of your products contain an exfoliating acid or a retinoid high in the ingredient list. Many people space these across different evenings rather than layering them.`,
        productIds: exfoliantOrRetinoid.map((item) => item.productId),
      });
    } else if (activeProducts.length === 0 && items.length >= 3) {
      observations.push({
        kind: 'balance',
        severity: 'info',
        title: 'A gentle, supportive shelf',
        detail:
          'Nothing here is a strong treatment product — it is all cleansing, hydrating and protecting. That is a solid base if you are happy with how your skin looks.',
        productIds: [],
      });
    }

    /* ------------------------------------------------------------- gaps ----- */
    const coveredSteps = new Set(byStep.keys());
    const missing = ESSENTIAL_STEPS.filter((entry) => !coveredSteps.has(entry.step)).map((entry) => ({
      slug: entry.slug,
      name: entry.name,
      why: entry.why,
    }));
    for (const gap of missing) {
      observations.push({
        kind: 'gap',
        severity: 'info',
        title: `No ${gap.name.toLowerCase()} on your shelf`,
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
