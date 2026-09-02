import { Injectable } from '@nestjs/common';
import type { Subscription, SubscriptionPeriod, SubscriptionStatus } from '@prisma/client';
import {
  DEFAULT_PLAN_PRICING,
  SUBSCRIPTION_PERIODS,
  type SubscriptionDto,
  type SubscriptionPlanDto,
  type UpdateSubscriptionPlanPayload,
} from '@kosvia/shared';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Owns the subscription lifecycle and the admin-editable pricing. Payments do
 * not exist yet: every subscription is a MANUAL grant, but the shape (provider,
 * providerReference, expiresAt) is ready for App Store / Google Play / Stripe.
 */
@Injectable()
export class SubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  async plans(): Promise<SubscriptionPlanDto[]> {
    const rows = await this.prisma.subscriptionPlan.findMany();
    return SUBSCRIPTION_PERIODS.map((period) => {
      const row = rows.find((candidate) => candidate.period === period);
      if (!row) {
        return {
          period,
          priceMinor: DEFAULT_PLAN_PRICING[period].priceMinor,
          currency: DEFAULT_PLAN_PRICING[period].currency,
          isActive: true,
          updatedAt: null,
        };
      }
      return {
        period,
        priceMinor: row.priceMinor,
        currency: row.currency,
        isActive: row.isActive,
        updatedAt: row.updatedAt.toISOString(),
      };
    });
  }

  async updatePlan(
    period: SubscriptionPeriod,
    payload: UpdateSubscriptionPlanPayload,
  ): Promise<SubscriptionPlanDto> {
    const defaults = DEFAULT_PLAN_PRICING[period];
    const row = await this.prisma.subscriptionPlan.upsert({
      where: { period },
      create: {
        period,
        priceMinor: payload.priceMinor ?? defaults.priceMinor,
        currency: payload.currency ?? defaults.currency,
        isActive: payload.isActive ?? true,
      },
      update: {
        ...(payload.priceMinor !== undefined ? { priceMinor: payload.priceMinor } : {}),
        ...(payload.currency !== undefined ? { currency: payload.currency } : {}),
        ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
      },
    });
    return {
      period: row.period,
      priceMinor: row.priceMinor,
      currency: row.currency,
      isActive: row.isActive,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async find(userId: string): Promise<Subscription | null> {
    return this.prisma.subscription.findUnique({ where: { userId } });
  }

  /**
   * Applies an admin plan change. PREMIUM opens (or reactivates) a manual
   * subscription without an end date; FREE and CANCELLED close it.
   */
  async applyAdminStatus(
    userId: string,
    status: SubscriptionStatus,
    period: SubscriptionPeriod = 'MONTHLY',
  ): Promise<void> {
    if (status === 'PREMIUM') {
      await this.prisma.$transaction([
        this.prisma.user.update({ where: { id: userId }, data: { subscriptionStatus: status } }),
        this.prisma.subscription.upsert({
          where: { userId },
          create: { userId, period },
          update: {
            period,
            state: 'ACTIVE',
            startedAt: new Date(),
            expiresAt: null,
            canceledAt: null,
          },
        }),
      ]);
      return;
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { subscriptionStatus: status } });
      await tx.subscription.updateMany({
        where: { userId, state: { not: 'EXPIRED' } },
        data: { state: 'EXPIRED', canceledAt: new Date() },
      });
    });
  }

  /**
   * Downgrades a Premium user whose paid period ended. Returns true when the
   * subscription is past its end date and the user was moved off Premium.
   */
  async expireIfDue(userId: string, subscription: Subscription): Promise<boolean> {
    if (subscription.state === 'EXPIRED') {
      return true;
    }
    if (!subscription.expiresAt || subscription.expiresAt > new Date()) {
      return false;
    }
    await this.prisma.$transaction([
      this.prisma.subscription.update({
        where: { id: subscription.id },
        data: { state: 'EXPIRED' },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { subscriptionStatus: 'CANCELLED' },
      }),
    ]);
    return true;
  }

  toDto(subscription: Subscription): SubscriptionDto {
    return {
      period: subscription.period,
      state: subscription.state,
      startedAt: subscription.startedAt.toISOString(),
      expiresAt: subscription.expiresAt?.toISOString() ?? null,
      canceledAt: subscription.canceledAt?.toISOString() ?? null,
    };
  }
}
