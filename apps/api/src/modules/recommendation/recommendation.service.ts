import { Injectable } from '@nestjs/common';
import { Prisma, type RoutineStep } from '@prisma/client';
import type {
  DiscoveryFeedDto,
  DiscoverySectionDto,
  LocalisedText,
  ProductSummaryDto,
} from '@kosvia/shared';
import { BUDGET_CEILING } from '@kosvia/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PersonalMatchService } from '../scoring/personal-match.service';
import { CoarseMatchService } from '../scoring/coarse-match.service';
import { PRODUCT_INCLUDE, type ProductRow } from '../products/product.select';
import { toProductSummary, toScorable } from '../products/product.mapper';
import type { ViewerContext } from '../profile/viewer-context.service';
import { publicProductWhere } from '../products/product-visibility';

const COARSE_POOL_MIN = 80;
const COARSE_POOL_FACTOR = 8;

/** The steps a "basic routine" is made of, in the order you apply them. */
const CORE_ROUTINE: RoutineStep[] = ['CLEANSER', 'SERUM', 'MOISTURIZER', 'SPF'];

/**
 * The order money is committed in, which is not the order you apply things.
 * When a budget cannot stretch to all four, sun protection and a moisturiser
 * are the two worth keeping; a treatment serum is the first thing to drop.
 */
const ROUTINE_PRIORITY: RoutineStep[] = ['SPF', 'MOISTURIZER', 'CLEANSER', 'SERUM'];

export interface RoutinePlan {
  budget: number;
  totalPrice: number;
  averageMatch: number;
  steps: Array<{
    step: RoutineStep;
    label: string;
    product: ProductSummaryDto | null;
    reason: LocalisedText;
  }>;
  notes: LocalisedText[];
}

/**
 * RecommendationService — ranking, discovery and routine building.
 *
 * All ranking logic lives here rather than in controllers, so the AI layer, the
 * dashboard and the discovery feed all draw on exactly the same decisions.
 */
@Injectable()
export class RecommendationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly match: PersonalMatchService,
    private readonly coarseMatch: CoarseMatchService,
  ) {}

  /** Top products for this viewer, optionally restricted to a routine step. */
  async getPersonalizedProducts(
    viewer: ViewerContext,
    options: {
      limit?: number;
      routineStep?: RoutineStep;
      maxPrice?: number;
      excludeOwned?: boolean;
    } = {},
  ): Promise<ProductSummaryDto[]> {
    const { limit = 8, routineStep, maxPrice, excludeOwned = true } = options;

    const where: Prisma.ProductWhereInput = {
      ...publicProductWhere(),
      ...(routineStep && { category: { routineStep } }),
      ...(maxPrice !== undefined && { lowestPrice: { lte: new Prisma.Decimal(maxPrice) } }),
      ...(excludeOwned && viewer.shelf?.productIds.length
        ? { id: { notIn: viewer.shelf.productIds } }
        : {}),
      ...(viewer.profile?.excludedBrandIds.length
        ? { brandId: { notIn: viewer.profile.excludedBrandIds } }
        : {}),
    };

    // Pass A narrows the whole filtered set with the SQL upper bound; pass B
    // (rank) scores only those candidates exactly.
    const matching = await this.prisma.product.findMany({ where, select: { id: true } });
    const coarse = await this.coarseMatch.topCandidates(
      matching.map((row) => row.id),
      viewer.profile,
      viewer.shelf,
      Math.max(COARSE_POOL_MIN, limit * COARSE_POOL_FACTOR),
    );
    const rows = await this.prisma.product.findMany({
      where: { id: { in: coarse.map((candidate) => candidate.id) } },
      include: PRODUCT_INCLUDE,
    });

    return this.rank(rows, viewer).slice(0, limit);
  }

  async getSimilarProducts(
    productId: string,
    viewer: ViewerContext,
    limit = 6,
  ): Promise<ProductSummaryDto[]> {
    const subject = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { category: true },
    });
    if (!subject) return [];

    const rows = await this.prisma.product.findMany({
      where: {
        ...publicProductWhere(),
        id: { not: subject.id },
        category: { routineStep: subject.category.routineStep },
      },
      include: PRODUCT_INCLUDE,
      take: 60,
    });
    return this.rank(rows, viewer).slice(0, limit);
  }

  /**
   * The Discover feed. Sections adapt to the profile: a signed-in user with
   * concerns gets concern-led rows, everyone gets the evergreen ones.
   */
  async getDiscoveryFeed(viewer: ViewerContext): Promise<DiscoveryFeedDto> {
    const sections: DiscoverySectionDto[] = [];
    const shown = new Set<string>();

    const add = (section: DiscoverySectionDto) => {
      if (!section.products.length) return;
      for (const product of section.products) shown.add(product.id);
      sections.push(section);
    };

    // The candidate pool is wide so the diversity pass has room to work.
    const recommended = this.diversify(
      await this.getPersonalizedProducts(viewer, { limit: 40 }),
      10,
      shown,
    );
    add({
      key: 'recommended',
      title: viewer.profile ? 'Recommended for you' : 'Highest-rated formulas',
      subtitle: viewer.profile
        ? 'Ranked against your skin type, concerns, budget and what you already own.'
        : 'Complete your beauty profile to see how these score for you personally.',
      products: recommended,
    });

    if (viewer.profile?.concernSlugs.length) {
      const concernSlug = viewer.profile.concernSlugs[0];
      const rows = await this.prisma.product.findMany({
        where: {
          ...publicProductWhere(),
          ingredients: {
            some: { ingredient: { targetsConcerns: { some: { slug: concernSlug } } } },
          },
        },
        include: PRODUCT_INCLUDE,
        orderBy: { ingredientScore: 'desc' },
        take: 60,
      });
      const concern = await this.prisma.beautyConcern.findUnique({ where: { slug: concernSlug } });
      add({
        key: `concern-${concernSlug}`,
        title: `For ${concern?.name.toLowerCase() ?? concernSlug.replace(/-/g, ' ')}`,
        subtitle: 'Formulas containing ingredients commonly used for this concern.',
        products: this.diversify(this.rank(rows, viewer), 10, shown),
      });
    }

    const budgetCeiling = viewer.profile ? BUDGET_CEILING[viewer.profile.budget] : null;
    const affordableCeiling = budgetCeiling ?? 50;
    const affordable = await this.prisma.product.findMany({
      where: {
        ...publicProductWhere(),
        lowestPrice: { lte: new Prisma.Decimal(affordableCeiling) },
      },
      include: PRODUCT_INCLUDE,
      orderBy: [{ ingredientScore: 'desc' }],
      take: 40,
    });
    add({
      key: 'best-value',
      title: `Best under ${affordableCeiling} PLN`,
      subtitle: 'Strong formulas that do not cost much.',
      products: this.diversify(this.rank(affordable, viewer), 10, shown),
    });

    const fragranceFree = await this.prisma.product.findMany({
      where: { ...publicProductWhere(), isFragranceFree: true },
      include: PRODUCT_INCLUDE,
      orderBy: { ingredientScore: 'desc' },
      take: 40,
    });
    add({
      key: 'fragrance-free',
      title: 'Fragrance-free',
      subtitle: 'No added scent — the most common trigger for reactive skin.',
      products: this.diversify(this.rank(fragranceFree, viewer), 10, shown),
    });

    const spf = await this.prisma.product.findMany({
      where: { ...publicProductWhere(), category: { routineStep: 'SPF' } },
      include: PRODUCT_INCLUDE,
      take: 30,
    });
    add({
      key: 'daily-spf',
      title: 'Daily sun protection',
      subtitle: 'The one step that changes the most over time.',
      products: this.diversify(this.rank(spf, viewer), 10, shown),
    });

    return { sections };
  }

  /**
   * buildRoutine — the foundation of the future Smart Basket.
   *
   * Greedy, but not naively so. A pure per-step share of the budget spends the
   * early steps' allowance freely and then finds nothing left for sunscreen —
   * the one step that matters most. So the allocation first looks up the
   * cheapest option in each step, and never lets one step spend money the
   * remaining steps still need.
   */
  async buildRoutine(budget: number, viewer: ViewerContext): Promise<RoutinePlan> {
    const labels: Record<string, string> = {
      CLEANSER: 'Cleanser',
      SERUM: 'Treatment serum',
      MOISTURIZER: 'Moisturiser',
      SPF: 'Sun protection',
    };
    // Sunscreen and moisturiser carry the routine, so they get more of the budget.
    const share: Record<string, number> = {
      CLEANSER: 0.18,
      SERUM: 0.27,
      MOISTURIZER: 0.28,
      SPF: 0.27,
    };

    // What the cheapest acceptable option in each step costs.
    const floors = new Map<RoutineStep, number | null>();
    await Promise.all(
      CORE_ROUTINE.map(async (step) => {
        floors.set(step, await this.cheapestPrice(step, viewer));
      }),
    );

    const affordableSteps = CORE_ROUTINE.filter((step) => floors.get(step) !== null);
    const totalFloor = affordableSteps.reduce((sum, step) => sum + (floors.get(step) ?? 0), 0);

    const chosen = new Map<RoutineStep, RoutinePlan['steps'][number]>();
    const notes: LocalisedText[] = [];
    const skipped: string[] = [];
    let spent = 0;

    // Only reserve money for the steps still to come when the whole routine is
    // actually affordable. Otherwise the reservation would starve the very
    // first, most important step.
    const canAffordAll = totalFloor <= budget && affordableSteps.length === CORE_ROUTINE.length;
    if (!canAffordAll && affordableSteps.length === CORE_ROUTINE.length) {
      notes.push({
        code: 'routine-over-floor',
        text: `A complete four-step routine starts at about ${totalFloor.toFixed(2)} PLN, so ${budget} PLN will not cover all of it. Sun protection and a moisturiser are the two worth keeping.`,
        params: { floor: Math.round(totalFloor * 100) / 100, budget },
      });
    }

    let reserved = canAffordAll ? totalFloor : 0;

    for (const step of ROUTINE_PRIORITY) {
      const label = labels[step]!;
      const floor = floors.get(step);

      if (floor === null || floor === undefined) {
        chosen.set(step, {
          step,
          label,
          product: null,
          reason: {
            code: 'routine-step-absent',
            text: `We do not have a ${label.toLowerCase()} in the catalogue yet.`,
            params: { step },
          },
        });
        continue;
      }

      // Whatever is left once the remaining (lower-priority) steps are covered.
      reserved -= floor;
      const available = budget - spent - Math.max(0, reserved);
      const allowance = Math.min(Math.max(budget * share[step]!, floor), available);

      const picks =
        available >= floor
          ? await this.getPersonalizedProducts(viewer, {
              limit: 1,
              routineStep: step,
              maxPrice: allowance,
            })
          : [];

      const product = picks[0] ?? null;
      if (product?.lowestPrice) spent += product.lowestPrice;
      if (!product) skipped.push(label.toLowerCase());

      chosen.set(step, {
        step,
        label,
        product,
        reason: product
          ? product.personalMatch?.reasons[0]
            ? {
                code: `match:${product.personalMatch.reasons[0].code}`,
                text: product.personalMatch.reasons[0].label,
                params: (product.personalMatch.reasons[0].params ?? {}) as LocalisedText['params'],
              }
            : { code: 'routine-step-best', text: 'Best available match for this step' }
          : {
              code: 'routine-step-unaffordable',
              text: `Nothing here fits what is left of the budget — the cheapest is ${floor.toFixed(2)} PLN.`,
              params: { price: floor },
            },
      });
    }

    // Present in application order, not the order the budget was committed in.
    const steps = CORE_ROUTINE.map((step) => chosen.get(step)!);

    const matched = steps.map((entry) => entry.product?.personalMatch?.score ?? 0).filter(Boolean);
    const averageMatch = matched.length
      ? Math.round(matched.reduce((sum, value) => sum + value, 0) / matched.length)
      : 0;

    if (skipped.length) {
      const shortfall = Math.max(10, Math.ceil(totalFloor - budget));
      // Listed in the order you would apply them, not the order money was spent.
      const missing = steps
        .filter((entry) => !entry.product)
        .map((entry) => entry.label.toLowerCase());
      notes.push({
        code: 'routine-missing',
        text: `Missing from this plan: ${formatList(missing)}. Raising the budget by about ${shortfall} PLN would cover the whole routine.`,
        params: { steps: missing.join(', '), shortfall },
      });
    } else if (budget - spent > 20) {
      notes.push({
        code: 'routine-leftover',
        text: `You have ${(budget - spent).toFixed(2)} PLN left — an exfoliant or an eye cream would be the next step.`,
        params: { amount: Math.round((budget - spent) * 100) / 100 },
      });
    }
    notes.push({
      code: 'routine-introduce-slowly',
      text: 'Introduce one new active product at a time so you can tell what is working.',
    });

    return {
      budget,
      totalPrice: Math.round(spent * 100) / 100,
      averageMatch,
      steps,
      notes,
    };
  }

  /** Cheapest in-catalogue price for a routine step, respecting brand exclusions. */
  private async cheapestPrice(step: RoutineStep, viewer: ViewerContext): Promise<number | null> {
    const result = await this.prisma.product.aggregate({
      where: {
        ...publicProductWhere(),
        category: { routineStep: step },
        lowestPrice: { not: null },
        ...(viewer.profile?.excludedBrandIds.length
          ? { brandId: { notIn: viewer.profile.excludedBrandIds } }
          : {}),
      },
      _min: { lowestPrice: true },
    });
    const min = result._min.lowestPrice;
    return min === null ? null : Number(min.toString());
  }

  /**
   * Picks `limit` products from a ranked list without letting one formula or
   * one brand dominate, and preferring products the feed has not shown yet.
   *
   * Ranking alone produces rails that all look the same: the seed catalogue has
   * the same formula under several brands, so the top of every list is four
   * variants of one product. The constraints here are soft — anything skipped
   * is used as backfill rather than dropped, so a section is never left short.
   */
  private diversify(
    products: ProductSummaryDto[],
    limit: number,
    alreadyShown: Set<string>,
  ): ProductSummaryDto[] {
    const picked: ProductSummaryDto[] = [];
    const overflow: ProductSummaryDto[] = [];
    const seenNames = new Set<string>();
    const brandCounts = new Map<string, number>();

    for (const product of products) {
      const brandCount = brandCounts.get(product.brand.id) ?? 0;
      const repeats = seenNames.has(product.name) || brandCount >= 2;

      if (repeats || alreadyShown.has(product.id)) {
        overflow.push(product);
        continue;
      }
      seenNames.add(product.name);
      brandCounts.set(product.brand.id, brandCount + 1);
      picked.push(product);
      if (picked.length === limit) break;
    }

    for (const product of overflow) {
      if (picked.length >= limit) break;
      picked.push(product);
    }
    return picked.slice(0, limit);
  }

  /** Scores a candidate pool and returns it ordered by the personal score. */
  private rank(rows: ProductRow[], viewer: ViewerContext): ProductSummaryDto[] {
    const scores = this.match.scoreMany(rows.map(toScorable), viewer.profile, viewer.shelf);
    return rows
      .map((row) => toProductSummary(row, scores.get(row.id) ?? null))
      .sort(
        (a, b) =>
          (b.personalMatch?.score ?? 0) - (a.personalMatch?.score ?? 0) ||
          b.ingredientScore - a.ingredientScore,
      );
  }
}

/** "a, b and c" — the way a person would write a list. */
function formatList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
