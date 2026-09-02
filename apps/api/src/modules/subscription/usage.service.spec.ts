import { Prisma } from '@prisma/client';
import { UsageService } from './usage.service';
import type { PrismaService } from '../../common/prisma/prisma.service';

const uniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError('duplicate', {
    code: 'P2002',
    clientVersion: 'test',
  });

interface PrismaDouble {
  usageCounter: {
    findUnique: jest.Mock;
    upsert: jest.Mock;
    updateMany: jest.Mock;
  };
  personalMatchAnalysis: { create: jest.Mock };
  $transaction: jest.Mock;
}

const buildPrisma = (): PrismaDouble => {
  const prisma: PrismaDouble = {
    usageCounter: {
      findUnique: jest.fn(() => Promise.resolve(null)),
      upsert: jest.fn(() => Promise.resolve({})),
      updateMany: jest.fn(() => Promise.resolve({ count: 1 })),
    },
    personalMatchAnalysis: { create: jest.fn(() => Promise.resolve({})) },
    $transaction: jest.fn((callback: (tx: PrismaDouble) => Promise<unknown>) => callback(prisma)),
  };
  return prisma;
};

const buildService = (prisma: PrismaDouble) => new UsageService(prisma as unknown as PrismaService);

describe('UsageService', () => {
  it('consumes a credit when the counter is under the limit', async () => {
    const prisma = buildPrisma();
    const service = buildService(prisma);
    await expect(service.tryConsume('user-1', 'AI_MESSAGE', 5)).resolves.toBe(true);
    expect(prisma.usageCounter.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ used: { lt: 5 } }),
        data: { used: { increment: 1 } },
      }),
    );
  });

  it('refuses when the conditional increment hits no row', async () => {
    const prisma = buildPrisma();
    prisma.usageCounter.updateMany.mockResolvedValue({ count: 0 });
    const service = buildService(prisma);
    await expect(service.tryConsume('user-1', 'AI_MESSAGE', 5)).resolves.toBe(false);
  });

  it('short-circuits an unlimited metric without touching the database', async () => {
    const prisma = buildPrisma();
    const service = buildService(prisma);
    await expect(service.tryConsume('user-1', 'AI_MESSAGE', null)).resolves.toBe(true);
    expect(prisma.usageCounter.upsert).not.toHaveBeenCalled();
    expect(prisma.usageCounter.updateMany).not.toHaveBeenCalled();
  });

  it('releases only counters that hold at least one credit', async () => {
    const prisma = buildPrisma();
    const service = buildService(prisma);
    await service.release('user-1', 'AI_MESSAGE');
    expect(prisma.usageCounter.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ used: { gt: 0 } }),
        data: { used: { decrement: 1 } },
      }),
    );
  });

  it('never charges twice for the same product in a month', async () => {
    const prisma = buildPrisma();
    prisma.personalMatchAnalysis.create.mockRejectedValue(uniqueViolation());
    const service = buildService(prisma);
    await expect(service.tryConsumePersonalMatch('user-1', 'product-1', 20)).resolves.toBe(true);
    expect(prisma.usageCounter.updateMany).not.toHaveBeenCalled();
  });

  it('refuses a new product once the monthly quota is spent', async () => {
    const prisma = buildPrisma();
    prisma.usageCounter.updateMany.mockResolvedValue({ count: 0 });
    const service = buildService(prisma);
    await expect(service.tryConsumePersonalMatch('user-1', 'product-2', 20)).resolves.toBe(false);
  });

  it('treats a null personal-match limit as unlimited', async () => {
    const prisma = buildPrisma();
    const service = buildService(prisma);
    await expect(service.tryConsumePersonalMatch('user-1', 'product-1', null)).resolves.toBe(true);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
