import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PriceAlertDto } from '@kosvia/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PRODUCT_INCLUDE } from '../products/product.select';
import { decimalToNumber, toProductSummary, toScorable } from '../products/product.mapper';
import { PersonalMatchService } from '../scoring/personal-match.service';
import { ViewerContextService } from '../profile/viewer-context.service';
import type { CreatePriceAlertDto, UpdatePriceAlertDto } from './dto/price-alert.dto';

/**
 * Price alerts.
 *
 * The MVP evaluates `triggered` on read against the current lowest offer. The
 * background worker that watches feeds and sends notifications is deliberately
 * out of scope — see README, "Known limitations".
 */
@Injectable()
export class PriceAlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly match: PersonalMatchService,
    private readonly viewers: ViewerContextService,
  ) {}

  async list(userId: string): Promise<PriceAlertDto[]> {
    const [alerts, viewer] = await Promise.all([
      this.prisma.priceAlert.findMany({
        where: { userId },
        include: { product: { include: PRODUCT_INCLUDE } },
        orderBy: { createdAt: 'desc' },
      }),
      this.viewers.load(userId),
    ]);

    const scores = this.match.scoreMany(
      alerts.map((alert) => toScorable(alert.product)),
      viewer.profile,
      viewer.shelf,
    );

    return alerts.map((alert) => {
      const summary = toProductSummary(alert.product, scores.get(alert.productId) ?? null);
      const target = decimalToNumber(alert.targetPrice)!;
      return {
        id: alert.id,
        targetPrice: target,
        active: alert.active,
        createdAt: alert.createdAt.toISOString(),
        product: summary,
        triggered: summary.lowestPrice !== null && summary.lowestPrice <= target,
      };
    });
  }

  async create(userId: string, dto: CreatePriceAlertDto): Promise<PriceAlertDto> {
    const product = await this.prisma.product.findFirst({
      where: { OR: [{ id: dto.productId }, { slug: dto.productId }] },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('We could not find that product.');

    const existing = await this.prisma.priceAlert.findUnique({
      where: { userId_productId: { userId, productId: product.id } },
    });
    if (existing) throw new ConflictException('You already have an alert on that product.');

    const created = await this.prisma.priceAlert.create({
      data: {
        userId,
        productId: product.id,
        targetPrice: new Prisma.Decimal(dto.targetPrice),
      },
    });
    return (await this.list(userId)).find((alert) => alert.id === created.id)!;
  }

  async update(userId: string, id: string, dto: UpdatePriceAlertDto): Promise<PriceAlertDto> {
    await this.assertOwned(userId, id);
    await this.prisma.priceAlert.update({
      where: { id },
      data: {
        ...(dto.targetPrice !== undefined && { targetPrice: new Prisma.Decimal(dto.targetPrice) }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
    });
    return (await this.list(userId)).find((alert) => alert.id === id)!;
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.assertOwned(userId, id);
    await this.prisma.priceAlert.delete({ where: { id } });
  }

  private async assertOwned(userId: string, id: string): Promise<void> {
    const alert = await this.prisma.priceAlert.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!alert || alert.userId !== userId)
      throw new NotFoundException('That alert does not exist.');
  }
}
