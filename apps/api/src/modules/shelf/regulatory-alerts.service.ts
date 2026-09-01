import { Injectable } from '@nestjs/common';
import type { RegulatoryChangeKind as RegulatoryChangeKindEnum } from '@prisma/client';
import type { RegulatoryAlertDto, RegulatoryChangeKind } from '@kosvia/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PRODUCT_INCLUDE } from '../products/product.select';
import { toProductSummary } from '../products/product.mapper';

const ALERT_WINDOW_DAYS = 180;
const DAY_MS = 24 * 60 * 60 * 1000;

const KIND_TO_DTO: Record<RegulatoryChangeKindEnum, RegulatoryChangeKind> = {
  BECAME_PROHIBITED: 'became-prohibited',
  BECAME_RESTRICTED: 'became-restricted',
  PROHIBITION_LIFTED: 'prohibition-lifted',
  RESTRICTION_LIFTED: 'restriction-lifted',
};

/**
 * Computed on read, like PriceAlertDto.triggered — no per-user fanout rows.
 * An alert is a recent BECAME_* change whose ingredient sits in an unfinished
 * shelf product, and disappears once the user dismisses or after the window.
 */
@Injectable()
export class RegulatoryAlertsService {
  constructor(private readonly prisma: PrismaService) {}

  async alertsFor(userId: string): Promise<RegulatoryAlertDto[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { regulatoryAlertsSeenAt: true },
    });
    const windowStart = new Date(Date.now() - ALERT_WINDOW_DAYS * DAY_MS);
    const seenAt = user?.regulatoryAlertsSeenAt;
    const since = seenAt && seenAt > windowStart ? seenAt : windowStart;

    const changes = await this.prisma.regulatoryChange.findMany({
      where: {
        createdAt: { gt: since },
        kind: { in: ['BECAME_PROHIBITED', 'BECAME_RESTRICTED'] },
      },
      orderBy: { createdAt: 'desc' },
      include: { ingredient: { select: { id: true, inciName: true, slug: true } } },
    });
    const latestPerIngredient = new Map<string, (typeof changes)[number]>();
    for (const change of changes) {
      if (!latestPerIngredient.has(change.ingredientId)) {
        latestPerIngredient.set(change.ingredientId, change);
      }
    }
    if (!latestPerIngredient.size) {
      return [];
    }

    const ingredientIds = [...latestPerIngredient.keys()];
    const shelfItems = await this.prisma.userShelfItem.findMany({
      where: {
        userId,
        finishedAt: null,
        product: { ingredients: { some: { ingredientId: { in: ingredientIds } } } },
      },
      include: { product: { include: PRODUCT_INCLUDE } },
    });

    return [...latestPerIngredient.values()]
      .map((change) => {
        const affected = shelfItems.filter((item) =>
          item.product.ingredients.some((entry) => entry.ingredientId === change.ingredientId),
        );
        return {
          ingredientId: change.ingredientId,
          inciName: change.ingredient.inciName,
          slug: change.ingredient.slug,
          kind: KIND_TO_DTO[change.kind],
          newAnnex: change.newAnnex,
          changedAt: change.createdAt.toISOString(),
          products: affected.map((item) => toProductSummary(item.product, null)),
        };
      })
      .filter((alert) => alert.products.length > 0);
  }

  async markSeen(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { regulatoryAlertsSeenAt: new Date() },
    });
  }
}
