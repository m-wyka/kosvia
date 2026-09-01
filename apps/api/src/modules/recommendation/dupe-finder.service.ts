import { Injectable, NotFoundException } from '@nestjs/common';
import type { DupeMatchDto, DupeResultDto } from '@kosvia/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PersonalMatchService } from '../scoring/personal-match.service';
import { ProductTraitsService } from '../scoring/product-traits.service';
import { PRODUCT_INCLUDE, hasMatchedIngredient, type ProductRow } from '../products/product.select';
import { toProductSummary, toScorable } from '../products/product.mapper';
import type { ViewerContext } from '../profile/viewer-context.service';
import { publicProductWhere } from '../products/product-visibility';

const DUPE_NEIGHBOURS = 24;
const MIN_DUPE_OVERLAP = 0.2;
const MAX_DUPES = 8;
const MEANINGFUL_POSITION_LIMIT = 14;

@Injectable()
export class DupeFinderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly match: PersonalMatchService,
    private readonly traits: ProductTraitsService,
  ) {}

  async findDupes(idOrSlug: string, viewer: ViewerContext): Promise<DupeResultDto> {
    const subject = await this.prisma.product.findFirst({
      where: { AND: [publicProductWhere(), { OR: [{ id: idOrSlug }, { slug: idOrSlug }] }] },
      include: PRODUCT_INCLUDE,
    });
    if (!subject) {
      throw new NotFoundException('We could not find that product.');
    }

    const neighbours = await this.traits.similarByFingerprint(
      subject.id,
      subject.categoryId,
      DUPE_NEIGHBOURS,
    );
    const similarityById = new Map(neighbours.map((row) => [row.id, row.similarity]));

    const candidates = similarityById.size
      ? await this.prisma.product.findMany({
          where: { AND: [publicProductWhere(), { id: { in: [...similarityById.keys()] } }] },
          include: PRODUCT_INCLUDE,
        })
      : [];

    const scores = this.match.scoreMany(
      [subject, ...candidates].map(toScorable),
      viewer.profile,
      viewer.shelf,
    );
    const subjectSummary = toProductSummary(subject, scores.get(subject.id) ?? null);
    const subjectIngredients = this.meaningfulIngredientIds(subject);

    const dupes: DupeMatchDto[] = candidates
      .map((candidate) => {
        const candidateIngredients = this.meaningfulIngredientIds(candidate);
        const sharedCount = [...candidateIngredients].filter((id) =>
          subjectIngredients.has(id),
        ).length;
        const unionCount = subjectIngredients.size + candidateIngredients.size - sharedCount;
        return {
          candidate,
          sharedCount,
          overlap: unionCount ? sharedCount / unionCount : 0,
          similarity: similarityById.get(candidate.id) ?? 0,
        };
      })
      .filter(({ overlap }) => overlap > MIN_DUPE_OVERLAP)
      .sort((first, second) => second.similarity - first.similarity)
      .slice(0, MAX_DUPES)
      .map(({ candidate, sharedCount, similarity }) => {
        const summary = toProductSummary(candidate, scores.get(candidate.id) ?? null);
        return {
          product: summary,
          similarityPercent: Math.round(similarity * 100),
          sharedIngredientCount: sharedCount,
          priceDifference:
            subjectSummary.lowestPrice !== null && summary.lowestPrice !== null
              ? Math.round((summary.lowestPrice - subjectSummary.lowestPrice) * 100) / 100
              : null,
        };
      });

    return { subject: subjectSummary, dupes };
  }

  private meaningfulIngredientIds(row: ProductRow): Set<string> {
    return new Set(
      row.ingredients
        .filter(hasMatchedIngredient)
        .filter((entry) => entry.position <= MEANINGFUL_POSITION_LIMIT)
        .map((entry) => entry.ingredientId),
    );
  }
}
