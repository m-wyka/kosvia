import { Injectable } from '@nestjs/common';
import { Prisma, type UsageMetric } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { currentPeriodStart } from './usage-period';

class QuotaExceededSignal extends Error {}

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

/**
 * Monthly usage counters. The consume path is a conditional UPDATE
 * (`used < limit`), so two parallel requests can never both take the last
 * credit — one of them sees zero affected rows and is refused.
 */
@Injectable()
export class UsageService {
  constructor(private readonly prisma: PrismaService) {}

  async used(userId: string, metric: UsageMetric): Promise<number> {
    const counter = await this.prisma.usageCounter.findUnique({
      where: {
        userId_metric_periodStart: { userId, metric, periodStart: currentPeriodStart() },
      },
    });
    return counter?.used ?? 0;
  }

  async tryConsume(userId: string, metric: UsageMetric, limit: number | null): Promise<boolean> {
    if (limit === null) {
      return true;
    }
    const periodStart = currentPeriodStart();
    await this.prisma.usageCounter.upsert({
      where: { userId_metric_periodStart: { userId, metric, periodStart } },
      create: { userId, metric, periodStart },
      update: {},
    });
    const updated = await this.prisma.usageCounter.updateMany({
      where: { userId, metric, periodStart, used: { lt: limit } },
      data: { used: { increment: 1 } },
    });
    return updated.count === 1;
  }

  async release(userId: string, metric: UsageMetric): Promise<void> {
    await this.prisma.usageCounter.updateMany({
      where: { userId, metric, periodStart: currentPeriodStart(), used: { gt: 0 } },
      data: { used: { decrement: 1 } },
    });
  }

  /**
   * Spends one full-analysis credit for a product, at most once per product
   * per month. Returns false when the monthly quota is exhausted and the
   * product was not analysed yet this month.
   */
  async tryConsumePersonalMatch(
    userId: string,
    productId: string,
    limit: number | null,
  ): Promise<boolean> {
    if (limit === null) {
      return true;
    }
    const periodStart = currentPeriodStart();
    try {
      return await this.prisma.$transaction(async (tx) => {
        try {
          await tx.personalMatchAnalysis.create({ data: { userId, productId, periodStart } });
        } catch (error) {
          if (isUniqueViolation(error)) {
            return true;
          }
          throw error;
        }
        await tx.usageCounter.upsert({
          where: {
            userId_metric_periodStart: { userId, metric: 'PERSONAL_MATCH', periodStart },
          },
          create: { userId, metric: 'PERSONAL_MATCH', periodStart },
          update: {},
        });
        const updated = await tx.usageCounter.updateMany({
          where: { userId, metric: 'PERSONAL_MATCH', periodStart, used: { lt: limit } },
          data: { used: { increment: 1 } },
        });
        if (updated.count === 0) {
          throw new QuotaExceededSignal();
        }
        return true;
      });
    } catch (error) {
      if (error instanceof QuotaExceededSignal) {
        return false;
      }
      throw error;
    }
  }
}
