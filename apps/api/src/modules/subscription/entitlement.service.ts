import { Injectable } from '@nestjs/common';
import type { SubscriptionStatus } from '@prisma/client';
import {
  PLAN_LIMITS,
  type EntitlementUsageDto,
  type PlanLimits,
  type PlanTier,
  type SubscriptionOverviewDto,
} from '@kosvia/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { SubscriptionService } from './subscription.service';
import { UsageService } from './usage.service';
import { planLimitReachedException } from './plan-errors';
import { nextPeriodStart } from './usage-period';

/**
 * The single source of truth for Free vs Premium rules. Nothing outside this
 * module compares subscriptionStatus by hand.
 */
@Injectable()
export class EntitlementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionService,
    private readonly usage: UsageService,
  ) {}

  planForStatus(status: SubscriptionStatus): PlanTier {
    return status === 'PREMIUM' ? 'PREMIUM' : 'FREE';
  }

  /**
   * Resolves the effective plan, downgrading lazily when a paid period has
   * ended. Free-status users resolve without touching the database.
   */
  async currentPlan(user: Pick<AuthenticatedUser, 'id' | 'subscriptionStatus'>): Promise<PlanTier> {
    if (user.subscriptionStatus !== 'PREMIUM') {
      return 'FREE';
    }
    const subscription = await this.subscriptions.find(user.id);
    if (!subscription) {
      return 'PREMIUM';
    }
    const expired = await this.subscriptions.expireIfDue(user.id, subscription);
    return expired ? 'FREE' : 'PREMIUM';
  }

  async currentPlanById(userId: string): Promise<PlanTier> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, subscriptionStatus: true },
    });
    if (!user) {
      return 'FREE';
    }
    return this.currentPlan(user);
  }

  limitsFor(plan: PlanTier): PlanLimits {
    return PLAN_LIMITS[plan];
  }

  async consumeAiMessage(userId: string, plan: PlanTier): Promise<void> {
    const limit = this.limitsFor(plan).aiMessagesPerMonth;
    const allowed = await this.usage.tryConsume(userId, 'AI_MESSAGE', limit);
    if (!allowed) {
      throw planLimitReachedException('AI_MESSAGE', limit);
    }
  }

  async refundAiMessage(userId: string): Promise<void> {
    await this.usage.release(userId, 'AI_MESSAGE');
  }

  /** True when the viewer may see the full personalised analysis of this product. */
  async authoriseFullAnalysis(userId: string, plan: PlanTier, productId: string): Promise<boolean> {
    const limit = this.limitsFor(plan).personalMatchAnalysesPerMonth;
    return this.usage.tryConsumePersonalMatch(userId, productId, limit);
  }

  async assertPriceAlertCapacity(userId: string, plan: PlanTier): Promise<void> {
    const limit = this.limitsFor(plan).activePriceAlerts;
    const active = await this.prisma.priceAlert.count({ where: { userId, active: true } });
    if (active >= limit) {
      throw planLimitReachedException('PRICE_ALERT', limit);
    }
  }

  async assertShelfCapacity(userId: string, plan: PlanTier): Promise<void> {
    const limit = this.limitsFor(plan).shelfItems;
    if (limit === null) {
      return;
    }
    const items = await this.prisma.userShelfItem.count({ where: { userId } });
    if (items >= limit) {
      throw planLimitReachedException('SHELF_ITEM', limit);
    }
  }

  async overview(user: AuthenticatedUser): Promise<SubscriptionOverviewDto> {
    const plan = await this.currentPlan(user);
    const limits = this.limitsFor(plan);
    const [subscription, aiUsed, matchUsed, activeAlerts, shelfItems] = await Promise.all([
      this.subscriptions.find(user.id),
      this.usage.used(user.id, 'AI_MESSAGE'),
      this.usage.used(user.id, 'PERSONAL_MATCH'),
      this.prisma.priceAlert.count({ where: { userId: user.id, active: true } }),
      this.prisma.userShelfItem.count({ where: { userId: user.id } }),
    ]);
    return {
      plan,
      subscription:
        plan === 'PREMIUM' && subscription ? this.subscriptions.toDto(subscription) : null,
      limits,
      entitlements: {
        aiMessages: usageOf(limits.aiMessagesPerMonth, aiUsed),
        personalMatch: usageOf(limits.personalMatchAnalysesPerMonth, matchUsed),
        priceAlerts: usageOf(limits.activePriceAlerts, activeAlerts),
        shelfItems: usageOf(limits.shelfItems, shelfItems),
      },
      usageResetsAt: nextPeriodStart().toISOString(),
    };
  }
}

const usageOf = (limit: number | null, used: number): EntitlementUsageDto => ({
  limit,
  used,
  remaining: limit === null ? null : Math.max(0, limit - used),
});
