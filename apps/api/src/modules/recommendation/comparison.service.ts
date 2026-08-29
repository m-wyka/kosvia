import { BadRequestException, Injectable } from '@nestjs/common';
import { pricePerHundred } from '@kosvia/shared';
import type {
  ComparisonResultDto,
  ComparisonRowDto,
  ComparisonVerdictDto,
  LocalisedText,
} from '@kosvia/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PersonalMatchService } from '../scoring/personal-match.service';
import { PRODUCT_INCLUDE, type ProductRow } from '../products/product.select';
import { toProductDto, toScorable } from '../products/product.mapper';
import type { ViewerContext } from '../profile/viewer-context.service';

/**
 * Side-by-side comparison of 2-4 products, ending in an explicit recommendation.
 *
 * The verdict is computed, not written by AI: it weighs Personal Match most
 * heavily, then value per 100 ml, then formula quality.
 */
@Injectable()
export class ComparisonService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly match: PersonalMatchService,
  ) {}

  async compare(identifiers: string[], viewer: ViewerContext): Promise<ComparisonResultDto> {
    const unique = [...new Set(identifiers.filter(Boolean))];
    if (unique.length < 2 || unique.length > 4) {
      throw new BadRequestException('Choose between two and four products to compare.');
    }

    const rows = await this.prisma.product.findMany({
      where: { OR: [{ id: { in: unique } }, { slug: { in: unique } }] },
      include: PRODUCT_INCLUDE,
    });
    if (rows.length < 2) {
      throw new BadRequestException('We could only find one of those products.');
    }

    // Preserve the order the caller asked for — the UI columns depend on it.
    const ordered = unique
      .map((key) => rows.find((row) => row.id === key || row.slug === key))
      .filter((row): row is ProductRow => Boolean(row));

    const scores = this.match.scoreMany(ordered.map(toScorable), viewer.profile, viewer.shelf);
    const products = ordered.map((row) => toProductDto(row, scores.get(row.id) ?? null));

    const prices = products.map((p) => p.lowestPrice);
    const perHundred = ordered.map((row, index) =>
      pricePerHundred(prices[index], row.volume, row.volumeUnit),
    );
    const matches = ordered.map((row) => scores.get(row.id)?.score ?? 0);

    if (viewer.userId) {
      await this.prisma.productComparison.create({
        data: { userId: viewer.userId, productIds: ordered.map((row) => row.id) },
      });
    }

    const rowsOut: ComparisonRowDto[] = [
      this.row(
        'brand',
        'Brand',
        products.map((p) => p.brand.name),
        'none',
      ),
      this.row('price', 'Best price', prices, 'lower'),
      this.row(
        'volume',
        'Size',
        ordered.map((row) => (row.volume ? `${row.volume} ${row.volumeUnit ?? 'ml'}` : null)),
        'none',
      ),
      this.row('price-per-100', 'Price per 100 ml', perHundred, 'lower'),
      this.row('match', 'Personal Match', matches, 'higher'),
      this.row(
        'ingredient-score',
        'Ingredient score',
        products.map((p) => p.ingredientScore),
        'higher',
      ),
      this.row(
        'actives',
        'Key active ingredients',
        ordered.map(
          (row) =>
            row.ingredients
              .filter((entry) => entry.ingredient.isActiveIngredient)
              .slice(0, 3)
              .map((entry) => entry.ingredient.commonName ?? entry.ingredient.inciName)
              .join(', ') || 'None highlighted',
        ),
        'none',
      ),
      this.row(
        'fragrance',
        'Fragrance',
        products.map((p) => (p.isFragranceFree ? 'Fragrance-free' : 'Contains fragrance')),
        'none',
      ),
      this.row(
        'vegan',
        'Vegan',
        products.map((p) => (p.isVegan ? 'Yes' : 'Not stated')),
        'none',
      ),
      this.row(
        'cruelty-free',
        'Cruelty-free',
        products.map((p) => (p.isCrueltyFree ? 'Yes' : 'Not stated')),
        'none',
      ),
      this.row(
        'stores',
        'Available at',
        products.map((p) => p.offers.filter((o) => o.availability !== 'OUT_OF_STOCK').length),
        'higher',
      ),
    ];

    return { products, rows: rowsOut, verdict: this.verdict(products, matches, perHundred) };
  }

  private row(
    key: string,
    label: string,
    values: Array<string | number | null>,
    direction: ComparisonRowDto['direction'],
  ): ComparisonRowDto {
    let bestIndex: number | null = null;
    if (direction !== 'none') {
      const numeric = values.map((v) => (typeof v === 'number' ? v : null));
      const candidates = numeric
        .map((value, index) => ({ value, index }))
        .filter((entry): entry is { value: number; index: number } => entry.value !== null);
      if (candidates.length > 1) {
        const winner = candidates.reduce((best, entry) =>
          direction === 'higher'
            ? entry.value > best.value
              ? entry
              : best
            : entry.value < best.value
              ? entry
              : best,
        );
        // Only call a winner when there actually is a difference.
        if (candidates.some((entry) => entry.value !== winner.value)) bestIndex = winner.index;
      }
    }
    return { key, label, values, bestIndex, direction };
  }

  private verdict(
    products: ComparisonResultDto['products'],
    matches: number[],
    perHundred: Array<number | null>,
  ): ComparisonVerdictDto | null {
    if (products.length < 2) return null;

    const validPerHundred = perHundred.filter((v): v is number => v !== null);
    const bestValue = validPerHundred.length ? Math.min(...validPerHundred) : null;

    const ranked = products
      .map((product, index) => {
        const valueScore =
          bestValue !== null && perHundred[index] !== null
            ? (bestValue / perHundred[index]!) * 100
            : 60;
        return {
          index,
          product,
          // Personal Match dominates; value and formula quality break ties.
          composite: matches[index] * 0.6 + valueScore * 0.25 + product.ingredientScore * 0.15,
        };
      })
      .sort((a, b) => b.composite - a.composite);

    const winner = ranked[0];
    const runnerUp = ranked[1];
    const fullName = (product: ComparisonResultDto['products'][number]) =>
      `${product.brand.name} ${product.name}`;
    const reasons: LocalisedText[] = [];

    const winnerScore = matches[winner.index]!;
    const rivalScore = matches[runnerUp.index]!;
    const rival = fullName(runnerUp.product);

    if (winnerScore > rivalScore) {
      reasons.push({
        code: 'verdict-highest-match',
        text: `Highest Personal Match at ${winnerScore}%, against ${rivalScore}% for ${rival}.`,
        params: { score: winnerScore, rivalScore, rival },
      });
    } else if (winnerScore === rivalScore) {
      reasons.push({
        code: 'verdict-tied-match',
        text: `Ties with ${rival} on Personal Match at ${winnerScore}%, so the decision comes down to value.`,
        params: { score: winnerScore, rival },
      });
    } else {
      reasons.push({
        code: 'verdict-lower-match',
        text: `Slightly lower match than ${rival}, but it wins on the other measures.`,
        params: { rival },
      });
    }

    const winnerPerHundred = perHundred[winner.index];
    if (winnerPerHundred !== null && winnerPerHundred !== undefined && bestValue !== null) {
      reasons.push(
        winnerPerHundred === bestValue
          ? {
              code: 'verdict-best-value',
              text: `Best value in this comparison at ${winnerPerHundred.toFixed(2)} PLN per 100 ml.`,
              params: { price: winnerPerHundred },
            }
          : {
              code: 'verdict-value',
              text: `Costs ${winnerPerHundred.toFixed(2)} PLN per 100 ml.`,
              params: { price: winnerPerHundred },
            },
      );
    }

    if (winner.product.isFragranceFree) {
      reasons.push({
        code: 'verdict-fragrance-free',
        text: 'Fragrance-free, which keeps it usable if your skin reacts easily.',
      });
    }
    reasons.push({
      code: 'verdict-ingredient-score',
      text: `Ingredient score of ${winner.product.ingredientScore} out of 100.`,
      params: { score: winner.product.ingredientScore },
    });

    return {
      productId: winner.product.id,
      productName: fullName(winner.product),
      summary: {
        code: 'verdict-summary',
        text: `Kosvia recommends ${fullName(winner.product)}.`,
        params: { product: fullName(winner.product) },
      },
      reasons,
    };
  }
}
