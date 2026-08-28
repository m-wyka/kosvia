import { Injectable } from '@nestjs/common';
import type { RoutineStep } from '@prisma/client';
import type { AiProductSuggestion, ProductSummaryDto } from '@kosvia/shared';
import { BUDGET_CEILING, formatPrice } from '@kosvia/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RecommendationService, type RoutinePlan } from '../recommendation/recommendation.service';
import { ProductsService } from '../products/products.service';
import { PRODUCT_INCLUDE } from '../products/product.select';
import type { ViewerContext } from '../profile/viewer-context.service';
import type { AdvisorContext, RetrievedProduct } from './providers/ai-provider.interface';

/**
 * BeautyAdvisorService — the retrieval half of the AI Beauty Shopper.
 *
 * Flow (and the order matters):
 *   question → intent → profile + shelf → product search → recommendation
 *   engine → real products → provider writes prose → answer
 *
 * The model is never given database access. It is handed a fixed list of rows
 * this service retrieved, and told it may not mention anything else.
 */

const STEP_KEYWORDS: Array<{ step: RoutineStep; words: string[] }> = [
  { step: 'CLEANSER', words: ['cleanser', 'cleansing', 'wash', 'face wash', 'micellar', 'żel do mycia', 'oczyszcz'] },
  { step: 'TONER', words: ['toner', 'essence', 'tonik'] },
  { step: 'EXFOLIANT', words: ['exfoliant', 'exfoliate', 'peel', 'acid', 'aha', 'bha', 'kwas', 'złuszcz'] },
  { step: 'SERUM', words: ['serum', 'ampoule', 'retinol', 'vitamin c', 'niacinamide', 'peptide'] },
  { step: 'EYE', words: ['eye cream', 'eye care', 'pod oczy', 'oczy'] },
  { step: 'MOISTURIZER', words: ['moisturiser', 'moisturizer', 'cream', 'gel cream', 'krem', 'nawilż'] },
  { step: 'SPF', words: ['spf', 'sunscreen', 'sun cream', 'filtr', 'uv', 'sun protection'] },
  { step: 'MASK', words: ['mask', 'maska'] },
  { step: 'BODY', words: ['body', 'hand cream', 'balsam', 'dłoni'] },
  { step: 'HAIR', words: ['shampoo', 'conditioner', 'szampon', 'odżywka', 'hair'] },
];

export interface AdvisorResult {
  answer: string;
  suggestions: AiProductSuggestion[];
  /** Kept for the conversation record and for debugging retrieval quality. */
  intentSummary: string;
}

export interface RetrievalResult {
  retrieved: RetrievedProduct[];
  /** Set only when the question asked for a whole routine. */
  routine: RoutinePlan | null;
}

export interface ParsedIntent {
  routineStep: RoutineStep | null;
  maxPrice: number | null;
  wantsCheaper: boolean;
  wantsShelfCheck: boolean;
  wantsRoutine: boolean;
  summary: string;
}

@Injectable()
export class BeautyAdvisorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recommendations: RecommendationService,
    private readonly products: ProductsService,
  ) {}

  /* --------------------------------------------------------------- intent -- */

  /**
   * Intent parsing is rule-based, not model-based. Getting "under 70 PLN"
   * wrong is a correctness bug, not a phrasing one, so it does not belong in
   * a language model.
   */
  parseIntent(question: string, viewer: ViewerContext): ParsedIntent {
    const text = question.toLowerCase();

    const step = STEP_KEYWORDS.find((entry) => entry.words.some((word) => text.includes(word)))?.step ?? null;

    let maxPrice: number | null = null;
    const currency = /(\d+(?:[.,]\d+)?)\s*(?:zł|zl|pln)/i.exec(text);
    const bounded = /(?:under|below|less than|up to|max|do|poniżej|za max)\s*(\d+(?:[.,]\d+)?)/i.exec(text);
    const raw = currency?.[1] ?? bounded?.[1];
    if (raw) maxPrice = Number(raw.replace(',', '.'));
    if (maxPrice === null && viewer.profile) maxPrice = BUDGET_CEILING[viewer.profile.budget];

    const wantsCheaper = /(cheap|cheaper|budget|affordable|tan|tańsz|zamiennik|alternativ)/i.test(text);
    const wantsShelfCheck = /(already have|do i (own|have)|mam ju|on my shelf|na półce|półce|duplicate)/i.test(text);
    const wantsRoutine = /(routine|rutyn|full set|whole set|starter|zestaw|basic set)/i.test(text);

    const parts: string[] = [];
    parts.push(step ? `a ${step.toLowerCase().replace('_', ' ')}` : 'products');
    if (maxPrice !== null) parts.push(`under ${maxPrice} PLN`);
    if (viewer.profile) parts.push(`for ${viewer.profile.skinType.toLowerCase()} skin`);
    if (wantsRoutine) parts.unshift('a full routine —');

    return {
      routineStep: step,
      maxPrice,
      wantsCheaper,
      wantsShelfCheck,
      wantsRoutine,
      summary: parts.join(' '),
    };
  }

  /* ------------------------------------------------------------ retrieval -- */

  async retrieve(intent: ParsedIntent, viewer: ViewerContext): Promise<RetrievalResult> {
    const retrieved: RetrievedProduct[] = [];

    // 1. Does the user already own something for this?
    if (viewer.userId && (intent.wantsShelfCheck || intent.routineStep)) {
      const owned = await this.prisma.userShelfItem.findMany({
        where: {
          userId: viewer.userId,
          finishedAt: null,
          ...(intent.routineStep && { product: { category: { routineStep: intent.routineStep } } }),
        },
        include: { product: { include: PRODUCT_INCLUDE } },
        take: 3,
      });
      for (const item of owned) {
        const summary = this.products.decorate([item.product], viewer)[0];
        retrieved.push({
          role: 'already-owned',
          product: summary,
          matchScore: summary.personalMatch?.score ?? null,
          reasons: ['Already on your shelf'],
          warnings: [],
        });
      }
    }

    // 2. A full routine, when that is what was asked for.
    if (intent.wantsRoutine) {
      const plan = await this.recommendations.buildRoutine(intent.maxPrice ?? 200, viewer);
      for (const step of plan.steps) {
        if (!step.product) continue;
        retrieved.push({
          role: 'best-match',
          label: step.label,
          product: step.product,
          matchScore: step.product.personalMatch?.score ?? null,
          reasons: [step.reason],
          warnings: step.product.personalMatch?.warnings.map((w) => w.label) ?? [],
        });
      }
      return { retrieved, routine: plan };
    }

    // 3. The main recommendation pass.
    const best = await this.recommendations.getPersonalizedProducts(viewer, {
      limit: 3,
      routineStep: intent.routineStep ?? undefined,
      maxPrice: intent.maxPrice ?? undefined,
    });

    best.forEach((product, index) => {
      retrieved.push({
        role: index === 0 ? 'best-match' : 'alternative',
        product,
        matchScore: product.personalMatch?.score ?? null,
        reasons: product.personalMatch?.reasons.slice(0, 3).map((r) => r.label) ?? [],
        warnings: product.personalMatch?.warnings.slice(0, 2).map((w) => w.label) ?? [],
      });
    });

    // 4. A cheaper option, when the question asked for one or the best pick is
    //    not the cheapest thing that would work.
    const cheapestSoFar = Math.min(
      ...retrieved.map((entry) => entry.product.lowestPrice ?? Number.POSITIVE_INFINITY),
    );
    if (Number.isFinite(cheapestSoFar)) {
      const budget = intent.wantsCheaper ? cheapestSoFar * 0.8 : cheapestSoFar * 0.75;
      const cheaper = await this.recommendations.getPersonalizedProducts(viewer, {
        limit: 1,
        routineStep: intent.routineStep ?? undefined,
        maxPrice: budget,
      });
      for (const product of cheaper) {
        if (retrieved.some((entry) => entry.product.id === product.id)) continue;
        retrieved.push({
          role: 'cheaper',
          product,
          matchScore: product.personalMatch?.score ?? null,
          reasons: product.personalMatch?.reasons.slice(0, 2).map((r) => r.label) ?? [],
          warnings: product.personalMatch?.warnings.slice(0, 1).map((w) => w.label) ?? [],
        });
      }
    }

    return { retrieved, routine: null };
  }

  /** Assembles everything the provider is allowed to see. */
  async buildContext(
    question: string,
    viewer: ViewerContext,
    history: AdvisorContext['history'],
  ): Promise<{ context: AdvisorContext; retrieved: RetrievedProduct[]; intent: ParsedIntent }> {
    const intent = this.parseIntent(question, viewer);
    const { retrieved, routine } = await this.retrieve(intent, viewer);

    const shelfSummary = viewer.userId
      ? (
          await this.prisma.userShelfItem.findMany({
            where: { userId: viewer.userId, finishedAt: null },
            include: { product: { include: { brand: true, category: true } } },
            take: 12,
          })
        ).map((item) => `${item.product.brand.name} ${item.product.name} (${item.product.category.name})`)
      : [];

    return {
      intent,
      retrieved,
      context: {
        question,
        isRoutine: routine !== null,
        routineTotal: routine?.totalPrice ?? null,
        routineNotes: routine?.notes ?? [],
        intentSummary: intent.summary,
        profileSummary: this.describeProfile(viewer),
        shelfSummary,
        retrieved,
        history,
      },
    };
  }

  toSuggestions(retrieved: RetrievedProduct[]): AiProductSuggestion[] {
    const labels: Record<RetrievedProduct['role'], string> = {
      'best-match': 'Best match',
      cheaper: 'Cheaper option',
      alternative: 'Also worth a look',
      'already-owned': 'Already yours',
    };
    return retrieved.map((entry) => ({
      role: entry.role,
      label: entry.label ?? labels[entry.role],
      reason:
        entry.reasons[0] ??
        (entry.product.lowestPrice ? `Available from ${formatPrice(entry.product.lowestPrice)}` : ''),
      product: entry.product satisfies ProductSummaryDto,
    }));
  }

  private describeProfile(viewer: ViewerContext): string | null {
    const profile = viewer.profile;
    if (!profile) return null;
    const parts = [
      `${profile.skinType.toLowerCase()} skin`,
      `${profile.sensitivity.toLowerCase()} sensitivity`,
    ];
    if (profile.concernSlugs.length) parts.push(`concerns: ${profile.concernSlugs.join(', ')}`);
    if (profile.goalSlugs.length) parts.push(`goals: ${profile.goalSlugs.join(', ')}`);
    const ceiling = BUDGET_CEILING[profile.budget];
    parts.push(ceiling ? `budget up to ${ceiling} PLN` : 'no budget limit');
    if (profile.fragrancePreference !== 'NO_PREFERENCE') {
      parts.push(profile.fragrancePreference.toLowerCase().replace(/_/g, ' '));
    }
    if (profile.veganPreference) parts.push('prefers vegan');
    if (profile.crueltyFreePreference) parts.push('prefers cruelty-free');
    return parts.join(', ');
  }
}
