import { ForbiddenException } from '@nestjs/common';
import { PLAN_LIMIT_REACHED_CODE, type ApiErrorBody } from '@kosvia/shared';
import { EntitlementService } from './entitlement.service';
import { SubscriptionService } from './subscription.service';
import type { UsageService } from './usage.service';
import type { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

const freeUser: AuthenticatedUser = {
  id: 'user-free',
  email: 'free@kosvia.app',
  role: 'USER',
  subscriptionStatus: 'FREE',
};

const premiumUser: AuthenticatedUser = {
  ...freeUser,
  id: 'user-premium',
  subscriptionStatus: 'PREMIUM',
};

interface PrismaDouble {
  subscription: { findUnique: jest.Mock; update: jest.Mock };
  user: { update: jest.Mock; findUnique: jest.Mock };
  priceAlert: { count: jest.Mock };
  userShelfItem: { count: jest.Mock };
  $transaction: jest.Mock;
}

const buildPrisma = (): PrismaDouble => ({
  subscription: {
    findUnique: jest.fn(() => Promise.resolve(null)),
    update: jest.fn(() => Promise.resolve({})),
  },
  user: {
    update: jest.fn(() => Promise.resolve({})),
    findUnique: jest.fn(() => Promise.resolve(null)),
  },
  priceAlert: { count: jest.fn(() => Promise.resolve(0)) },
  userShelfItem: { count: jest.fn(() => Promise.resolve(0)) },
  $transaction: jest.fn((operations: Array<Promise<unknown>>) => Promise.all(operations)),
});

const usageDouble = {
  used: jest.fn(() => Promise.resolve(0)),
  tryConsume: jest.fn(() => Promise.resolve(true)),
  release: jest.fn(() => Promise.resolve()),
  tryConsumePersonalMatch: jest.fn(() => Promise.resolve(true)),
} as unknown as UsageService;

const buildService = (prisma: PrismaDouble) =>
  new EntitlementService(
    prisma as unknown as PrismaService,
    new SubscriptionService(prisma as unknown as PrismaService),
    usageDouble,
  );

const limitCode = (error: unknown): string | undefined =>
  ((error as ForbiddenException).getResponse() as ApiErrorBody).code;

describe('EntitlementService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves FREE without touching the subscription table', async () => {
    const prisma = buildPrisma();
    const service = buildService(prisma);
    await expect(service.currentPlan(freeUser)).resolves.toBe('FREE');
    expect(prisma.subscription.findUnique).not.toHaveBeenCalled();
  });

  it('keeps a manual Premium grant without a subscription row', async () => {
    const prisma = buildPrisma();
    const service = buildService(prisma);
    await expect(service.currentPlan(premiumUser)).resolves.toBe('PREMIUM');
  });

  it('keeps Premium while a subscription has time left, even when canceled', async () => {
    const prisma = buildPrisma();
    prisma.subscription.findUnique.mockResolvedValue({
      id: 'sub-1',
      state: 'CANCELED',
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    const service = buildService(prisma);
    await expect(service.currentPlan(premiumUser)).resolves.toBe('PREMIUM');
  });

  it('downgrades lazily once the paid period is over', async () => {
    const prisma = buildPrisma();
    prisma.subscription.findUnique.mockResolvedValue({
      id: 'sub-1',
      state: 'ACTIVE',
      expiresAt: new Date(Date.now() - 86_400_000),
    });
    const service = buildService(prisma);
    await expect(service.currentPlan(premiumUser)).resolves.toBe('FREE');
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { state: 'EXPIRED' } }),
    );
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { subscriptionStatus: 'CANCELLED' } }),
    );
  });

  it('blocks the second active price alert on Free', async () => {
    const prisma = buildPrisma();
    prisma.priceAlert.count.mockResolvedValue(1);
    const service = buildService(prisma);
    const attempt = service.assertPriceAlertCapacity('user-free', 'FREE');
    await expect(attempt).rejects.toBeInstanceOf(ForbiddenException);
    await attempt.catch((error) => {
      expect(limitCode(error)).toBe(PLAN_LIMIT_REACHED_CODE);
    });
  });

  it('allows Premium up to twenty active price alerts', async () => {
    const prisma = buildPrisma();
    prisma.priceAlert.count.mockResolvedValue(19);
    const service = buildService(prisma);
    await expect(
      service.assertPriceAlertCapacity('user-premium', 'PREMIUM'),
    ).resolves.toBeUndefined();
    prisma.priceAlert.count.mockResolvedValue(20);
    await expect(
      service.assertPriceAlertCapacity('user-premium', 'PREMIUM'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks the eleventh shelf product on Free and never counts for Premium', async () => {
    const prisma = buildPrisma();
    prisma.userShelfItem.count.mockResolvedValue(10);
    const service = buildService(prisma);
    await expect(service.assertShelfCapacity('user-free', 'FREE')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    prisma.userShelfItem.count.mockClear();
    await expect(service.assertShelfCapacity('user-premium', 'PREMIUM')).resolves.toBeUndefined();
    expect(prisma.userShelfItem.count).not.toHaveBeenCalled();
  });

  it('reports Free limits and usage in the overview', async () => {
    const prisma = buildPrisma();
    prisma.priceAlert.count.mockResolvedValue(1);
    prisma.userShelfItem.count.mockResolvedValue(4);
    (usageDouble.used as jest.Mock).mockResolvedValueOnce(2).mockResolvedValueOnce(7);
    const service = buildService(prisma);
    const overview = await service.overview(freeUser);
    expect(overview.plan).toBe('FREE');
    expect(overview.entitlements.aiMessages).toEqual({ limit: 5, used: 2, remaining: 3 });
    expect(overview.entitlements.personalMatch).toEqual({ limit: 20, used: 7, remaining: 13 });
    expect(overview.entitlements.priceAlerts).toEqual({ limit: 1, used: 1, remaining: 0 });
    expect(overview.entitlements.shelfItems).toEqual({ limit: 10, used: 4, remaining: 6 });
  });
});
