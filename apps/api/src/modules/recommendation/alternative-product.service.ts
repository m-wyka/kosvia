import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  AlternativeGroupDto,
  AlternativeKind,
  LocalisedText,
  ProductSummaryDto,
} from '@kosvia/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PersonalMatchService } from '../scoring/personal-match.service';
import { PRODUCT_INCLUDE, hasMatchedIngredient, type ProductRow } from '../products/product.select';
import { decimalToNumber, toProductSummary, toScorable } from '../products/product.mapper';
import type { ViewerContext } from '../profile/viewer-context.service';

type Scored = {
  row: ProductRow;
  summary: ProductSummaryDto;
  price: number | null;
  match: number;
};

const GROUP_SIZE = 4;

/**
 * AlternativeProductService — "show me something else".
 *
 * Alternatives are found structurally, never by text similarity: candidates
 * come from the same routine step, and are then ranked on price, Personal
 * Match, value, or measured ingredient overlap depending on what was asked for.
 */
@Injectable()
export class AlternativeProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly match: PersonalMatchService,
  ) {}

  async forProduct(idOrSlug: string, viewer: ViewerContext): Promise<AlternativeGroupDto[]> {
    const subject = await this.prisma.product.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      include: PRODUCT_INCLUDE,
    });
    if (!subject) throw new NotFoundException('We could not find that product.');

    const candidates = await this.candidatePool(subject);
    const scored = this.score([subject, ...candidates], viewer);
    const self = scored.find((entry) => entry.row.id === subject.id)!;
    const others = scored.filter((entry) => entry.row.id !== subject.id);

    const groups: AlternativeGroupDto[] = [];
    const push = (
      kind: AlternativeKind,
      title: string,
      description: string,
      picks: Array<{ entry: Scored; reason: LocalisedText }>,
    ) => {
      if (!picks.length) return;
      groups.push({
        kind,
        title,
        description,
        products: picks.map(({ entry, reason }) => ({
          ...entry.summary,
          alternativeReason: reason,
        })),
      });
    };

    /* -------------------------------------------------------------- cheaper */
    if (self.price !== null) {
      const cheaper = others
        .filter((entry) => entry.price !== null && entry.price < self.price! * 0.95)
        .sort((a, b) => a.price! - b.price! || b.match - a.match)
        .slice(0, GROUP_SIZE)
        .map((entry) => {
          const percent = Math.round((1 - entry.price! / self.price!) * 100);
          return {
            entry,
            reason: {
              code: 'alt-cheaper',
              text: `${percent}% less than ${subject.name}`,
              params: { percent, product: subject.name },
            },
          };
        });
      push('cheaper', 'Cheaper', `Same routine step as ${subject.name}, for less.`, cheaper);
    }

    /* --------------------------------------------------------- better match */
    const betterMatch = others
      .filter((entry) => entry.match > self.match + 2)
      .sort((a, b) => b.match - a.match)
      .slice(0, GROUP_SIZE)
      .map((entry) => ({
        entry,
        reason: {
          code: 'alt-better-match',
          text: `${entry.match}% match — ${entry.match - self.match} points above this product`,
          params: { score: entry.match, delta: entry.match - self.match },
        },
      }));
    push(
      'better-match',
      'Better match',
      'Closer to your profile than the product you are viewing.',
      betterMatch,
    );

    /* --------------------------------------------------------- better value */
    const value = others
      .filter((entry) => entry.price !== null && entry.price > 0)
      .map((entry) => ({ entry, ratio: entry.match / entry.price! }))
      .filter(({ ratio }) => (self.price ? ratio > self.match / self.price : true))
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, GROUP_SIZE)
      .map(({ entry }) => ({
        entry,
        reason: {
          code: 'alt-better-value',
          text: `${entry.match}% match at ${entry.price!.toFixed(2)} PLN`,
          params: { score: entry.match, price: entry.price! },
        },
      }));
    push(
      'better-value',
      'Better value',
      'The strongest match per złoty in this routine step.',
      value,
    );

    /* -------------------------------------------------- similar ingredients */
    const subjectIngredients = new Set(
      subject.ingredients
        .filter(hasMatchedIngredient)
        .filter((i) => i.position <= 14)
        .map((i) => i.ingredientId),
    );
    const similar = others
      .map((entry) => ({ entry, overlap: this.overlap(subjectIngredients, entry.row) }))
      .filter(({ overlap }) => overlap > 0.32)
      .sort((a, b) => b.overlap - a.overlap)
      .slice(0, GROUP_SIZE)
      .map(({ entry, overlap }) => ({
        entry,
        reason: {
          code: 'alt-similar-ingredients',
          text: `${Math.round(overlap * 100)}% of the key ingredients overlap`,
          params: { percent: Math.round(overlap * 100) },
        },
      }));
    push(
      'similar-ingredients',
      'Similar ingredients',
      'Formulas built from largely the same ingredient list.',
      similar,
    );

    /* ----------------------------------------------------- similar purpose */
    const usedIds = new Set(groups.flatMap((group) => group.products.map((p) => p.id)));
    const purpose = others
      .filter((entry) => !usedIds.has(entry.row.id))
      .sort((a, b) => b.match - a.match)
      .slice(0, GROUP_SIZE)
      .map((entry) => ({
        entry,
        reason: {
          code: 'alt-similar-purpose',
          text: `Another ${subject.category.name.toLowerCase()} option`,
          // The slug lets a client name the category in its own language.
          params: { category: subject.category.slug },
        },
      }));
    push(
      'similar-purpose',
      'Same job, different formula',
      `Other products that do what ${subject.name} does.`,
      purpose,
    );

    return groups;
  }

  /**
   * Candidates share the routine step rather than the exact category, so a
   * gel cream can be offered as an alternative to a barrier cream.
   */
  private async candidatePool(subject: ProductRow): Promise<ProductRow[]> {
    return this.prisma.product.findMany({
      where: {
        isActive: true,
        id: { not: subject.id },
        category: { routineStep: subject.category.routineStep },
      },
      include: PRODUCT_INCLUDE,
      take: 120,
    });
  }

  private score(rows: ProductRow[], viewer: ViewerContext): Scored[] {
    const scores = this.match.scoreMany(rows.map(toScorable), viewer.profile, viewer.shelf);
    return rows.map((row) => {
      const personalMatch = scores.get(row.id) ?? null;
      const summary = toProductSummary(row, personalMatch);
      return {
        row,
        summary,
        price: summary.lowestPrice ?? decimalToNumber(row.lowestPrice),
        match: personalMatch?.score ?? 0,
      };
    });
  }

  /** Jaccard overlap over the meaningful (high-position) part of both lists. */
  private overlap(subjectIngredients: Set<string>, candidate: ProductRow): number {
    const other = new Set(
      candidate.ingredients
        .filter(hasMatchedIngredient)
        .filter((i) => i.position <= 14)
        .map((i) => i.ingredientId),
    );
    if (!subjectIngredients.size || !other.size) return 0;
    let shared = 0;
    for (const id of other) if (subjectIngredients.has(id)) shared += 1;
    return shared / (subjectIngredients.size + other.size - shared);
  }
}
