import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { RoutineAnalysisDto, RoutinePlanDto, ShelfItemDto } from '@kosvia/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { EntitlementService } from '../subscription/entitlement.service';
import { restrictRoutineAnalysis } from '../subscription/plan-restrictions';
import { PRODUCT_INCLUDE } from '../products/product.select';
import { toProductSummary, toScorable } from '../products/product.mapper';
import { PersonalMatchService } from '../scoring/personal-match.service';
import { ViewerContextService } from '../profile/viewer-context.service';
import { RoutineAnalysisService } from '../recommendation/routine-analysis.service';
import { RoutinePlanService } from '../recommendation/routine-plan.service';
import type { AddShelfItemDto, UpdateShelfItemDto } from './dto/shelf.dto';
import { publicProductWhere } from '../products/product-visibility';

@Injectable()
export class ShelfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly viewers: ViewerContextService,
    private readonly match: PersonalMatchService,
    private readonly routine: RoutineAnalysisService,
    private readonly routinePlan: RoutinePlanService,
    private readonly entitlements: EntitlementService,
  ) {}

  async list(user: AuthenticatedUser, favoritesOnly = false): Promise<ShelfItemDto[]> {
    const userId = user.id;
    const [items, viewer, plan] = await Promise.all([
      this.prisma.userShelfItem.findMany({
        where: { userId, ...(favoritesOnly && { isFavorite: true }) },
        include: { product: { include: PRODUCT_INCLUDE } },
        orderBy: { addedAt: 'desc' },
      }),
      this.viewers.load(userId),
      this.entitlements.currentPlan(user),
    ]);

    const scores = this.match.scoreMany(
      items.map((item) => toScorable(item.product)),
      viewer.profile,
      viewer.shelf,
    );

    return items.map((item) => ({
      id: item.id,
      addedAt: item.addedAt.toISOString(),
      openedAt: item.openedAt?.toISOString() ?? null,
      finishedAt: item.finishedAt?.toISOString() ?? null,
      isFavorite: item.isFavorite,
      notes: item.notes,
      paoMonths:
        plan === 'PREMIUM' ? (item.product.paoMonths ?? item.product.category.paoMonths) : null,
      product: toProductSummary(item.product, scores.get(item.productId) ?? null),
    }));
  }

  /**
   * Accepts a product id, slug or EAN. Accepting the EAN now means the future
   * barcode scanner is a UI change only — the API already speaks its language.
   */
  async add(user: AuthenticatedUser, dto: AddShelfItemDto): Promise<ShelfItemDto> {
    const userId = user.id;
    const key = dto.productId ?? dto.slug ?? dto.ean;
    if (!key) throw new NotFoundException('Tell us which product to add.');

    const plan = await this.entitlements.currentPlan(user);
    await this.entitlements.assertShelfCapacity(userId, plan);

    const product = await this.prisma.product.findFirst({
      where: {
        AND: [
          publicProductWhere(),
          { OR: [{ id: key }, { slug: key }, { variants: { some: { ean: key } } }] },
        ],
      },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('We do not have that product in the catalogue yet.');

    const existing = await this.prisma.userShelfItem.findUnique({
      where: { userId_productId: { userId, productId: product.id } },
    });
    if (existing) throw new ConflictException('That product is already on your shelf.');

    await this.prisma.userShelfItem.create({
      data: {
        userId,
        productId: product.id,
        notes: dto.notes ?? null,
        openedAt: dto.openedAt ? new Date(dto.openedAt) : null,
        isFavorite: dto.isFavorite ?? false,
      },
    });

    const items = await this.list(user);
    return items.find((item) => item.product.id === product.id)!;
  }

  async update(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateShelfItemDto,
  ): Promise<ShelfItemDto> {
    const userId = user.id;
    await this.assertOwned(userId, id);
    await this.prisma.userShelfItem.update({
      where: { id },
      data: {
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.isFavorite !== undefined && { isFavorite: dto.isFavorite }),
        ...(dto.openedAt !== undefined && {
          openedAt: dto.openedAt ? new Date(dto.openedAt) : null,
        }),
        ...(dto.finishedAt !== undefined && {
          finishedAt: dto.finishedAt ? new Date(dto.finishedAt) : null,
        }),
      },
    });
    const items = await this.list(user);
    return items.find((item) => item.id === id)!;
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.assertOwned(userId, id);
    await this.prisma.userShelfItem.delete({ where: { id } });
  }

  async analyse(user: AuthenticatedUser): Promise<RoutineAnalysisDto> {
    const [analysis, plan] = await Promise.all([
      this.routine.analyse(user.id),
      this.entitlements.currentPlan(user),
    ]);
    return restrictRoutineAnalysis(analysis, plan);
  }

  plan(userId: string): Promise<RoutinePlanDto> {
    return this.routinePlan.plan(userId);
  }

  private async assertOwned(userId: string, id: string): Promise<void> {
    const item = await this.prisma.userShelfItem.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!item || item.userId !== userId) {
      throw new NotFoundException('That shelf item does not exist.');
    }
  }
}
