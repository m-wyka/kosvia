import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { ScorableProfile, ShelfSnapshot } from '../scoring/types';

/**
 * Everything the scoring engine needs to know about the person looking at a
 * page, loaded in one round-trip and reused across a request.
 *
 * Anonymous visitors get `{ profile: null, shelf: undefined }`, which the
 * scoring engine handles by falling back to a formula-quality-only score.
 */
export interface ViewerContext {
  userId: string | null;
  profile: ScorableProfile | null;
  shelf?: ShelfSnapshot;
}

export const ANONYMOUS_VIEWER: ViewerContext = { userId: null, profile: null };

@Injectable()
export class ViewerContextService {
  constructor(private readonly prisma: PrismaService) {}

  async load(userId: string | null | undefined): Promise<ViewerContext> {
    if (!userId) return ANONYMOUS_VIEWER;

    const [profile, shelfItems] = await Promise.all([
      this.prisma.beautyProfile.findUnique({
        where: { userId },
        include: {
          concerns: { select: { slug: true } },
          goals: { select: { slug: true } },
          preferredBrands: { select: { id: true } },
          excludedBrands: { select: { id: true } },
          excludedIngredients: { select: { id: true } },
        },
      }),
      this.prisma.userShelfItem.findMany({
        where: { userId, finishedAt: null },
        select: { productId: true, product: { select: { categoryId: true } } },
      }),
    ]);

    const shelf: ShelfSnapshot = {
      productIds: shelfItems.map((item) => item.productId),
      categoryIds: [...new Set(shelfItems.map((item) => item.product.categoryId))],
    };

    if (!profile) return { userId, profile: null, shelf };

    return {
      userId,
      shelf,
      profile: {
        skinType: profile.skinType,
        sensitivity: profile.sensitivity,
        budget: profile.budget,
        fragrancePreference: profile.fragrancePreference,
        veganPreference: profile.veganPreference,
        crueltyFreePreference: profile.crueltyFreePreference,
        concernSlugs: profile.concerns.map((c) => c.slug),
        goalSlugs: profile.goals.map((g) => g.slug),
        preferredBrandIds: profile.preferredBrands.map((b) => b.id),
        excludedBrandIds: profile.excludedBrands.map((b) => b.id),
        excludedIngredientIds: profile.excludedIngredients.map((i) => i.id),
      },
    };
  }
}
