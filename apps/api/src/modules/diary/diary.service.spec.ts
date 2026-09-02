import { BadRequestException } from '@nestjs/common';
import { PLAN_LIMITS, type PlanTier } from '@kosvia/shared';
import { DiaryService } from './diary.service';
import type { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import type { EntitlementService } from '../subscription/entitlement.service';

const DAY_MS = 24 * 60 * 60 * 1000;

const premiumViewer: AuthenticatedUser = {
  id: 'user-1',
  email: 'demo@kosvia.app',
  role: 'USER',
  subscriptionStatus: 'PREMIUM',
};

const freeViewer: AuthenticatedUser = { ...premiumViewer, subscriptionStatus: 'FREE' };

const entitlementsDouble = {
  currentPlan: (user: AuthenticatedUser): Promise<PlanTier> =>
    Promise.resolve(user.subscriptionStatus === 'PREMIUM' ? 'PREMIUM' : 'FREE'),
  limitsFor: (plan: PlanTier) => PLAN_LIMITS[plan],
} as unknown as EntitlementService;

const isoDay = (offsetDays: number): string =>
  new Date(Date.now() + offsetDays * DAY_MS).toISOString().slice(0, 10);

const entryRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'entry-1',
  profileId: 'profile-1',
  date: new Date('2026-09-01T00:00:00Z'),
  overall: 4,
  hasBreakouts: false,
  hasDryness: true,
  hasIrritation: false,
  hasRedness: false,
  note: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const buildService = () => {
  const upsertCalls: Array<Record<string, unknown>> = [];
  const findManyCalls: Array<Record<string, unknown>> = [];
  const prisma = {
    beautyProfile: {
      upsert: jest.fn(() => Promise.resolve({ id: 'profile-1' })),
    },
    skinDiaryEntry: {
      upsert: jest.fn((args: Record<string, unknown>) => {
        upsertCalls.push(args);
        return Promise.resolve(entryRow());
      }),
      findMany: jest.fn((args: Record<string, unknown>): Promise<unknown[]> => {
        findManyCalls.push(args);
        return Promise.resolve([]);
      }),
      deleteMany: jest.fn(() => Promise.resolve({ count: 1 })),
    },
  };
  return {
    service: new DiaryService(prisma as unknown as PrismaService, entitlementsDouble),
    upsertCalls,
    findManyCalls,
    prisma,
  };
};

describe('DiaryService', () => {
  it('maps flags onto boolean columns on upsert', async () => {
    const { service, upsertCalls } = buildService();
    await service.upsert('user-1', isoDay(0), {
      overall: 3,
      flags: ['dryness', 'redness'],
      note: '  sucho po nowym kremie  ',
    });
    const create = upsertCalls[0]!.create as Record<string, unknown>;
    expect(create.hasDryness).toBe(true);
    expect(create.hasRedness).toBe(true);
    expect(create.hasBreakouts).toBe(false);
    expect(create.note).toBe('sucho po nowym kremie');
  });

  it('rejects days in the future', async () => {
    const { service } = buildService();
    await expect(service.upsert('user-1', isoDay(3), { overall: 3 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects days further back than the backdate window', async () => {
    const { service } = buildService();
    await expect(service.upsert('user-1', isoDay(-90), { overall: 3 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects malformed dates', async () => {
    const { service } = buildService();
    await expect(service.upsert('user-1', '2026-13-45', { overall: 3 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('queries exact month boundaries at UTC midnight', async () => {
    const { service, findManyCalls } = buildService();
    await service.month(premiumViewer, '2026-09');
    const where = findManyCalls[0]!.where as { date: { gte: Date; lt: Date } };
    expect(where.date.gte.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(where.date.lt.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    const previousWhere = findManyCalls[1]!.where as { date: { gte: Date; lt: Date } };
    expect(previousWhere.date.gte.toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });

  it('computes stats from entries and the previous month', async () => {
    const { service, prisma } = buildService();
    prisma.skinDiaryEntry.findMany
      .mockResolvedValueOnce([
        entryRow({ overall: 4, hasDryness: true }),
        entryRow({ id: 'entry-2', overall: 2, hasDryness: false, hasIrritation: true }),
      ])
      .mockResolvedValueOnce([entryRow({ id: 'entry-3', hasIrritation: true, hasDryness: false })]);
    const month = await service.month(premiumViewer, '2026-09');
    expect(month.stats.loggedDays).toBe(2);
    expect(month.stats.averageOverall).toBe(3);
    expect(month.stats.flagCounts.dryness).toBe(1);
    expect(month.stats.flagCounts.irritation).toBe(1);
    expect(month.stats.previousMonthFlagCounts.irritation).toBe(1);
  });

  it('trims Free history to the last 7 days and skips previous-month stats', async () => {
    const { service, findManyCalls } = buildService();
    const currentMonth = new Date().toISOString().slice(0, 7);
    const month = await service.month(freeViewer, currentMonth);
    expect(month.historyLimited).toBe(true);
    expect(month.stats.previousMonthFlagCounts.dryness).toBe(0);
    expect(findManyCalls).toHaveLength(1);
    const where = findManyCalls[0]!.where as { date: { gte: Date } };
    const sevenDaysAgo = Date.now() - 7 * DAY_MS;
    expect(where.date.gte.getTime()).toBeGreaterThanOrEqual(sevenDaysAgo - 60_000);
  });

  it('leaves Premium history unlimited', async () => {
    const { service } = buildService();
    const month = await service.month(premiumViewer, '2026-09');
    expect(month.historyLimited).toBe(false);
  });
});
