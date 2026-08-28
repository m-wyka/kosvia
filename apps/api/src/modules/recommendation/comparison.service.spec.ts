import { BadRequestException } from '@nestjs/common';
import { ComparisonService } from './comparison.service';
import { PersonalMatchService } from '../scoring/personal-match.service';
import type { PrismaService } from '../../common/prisma/prisma.service';
import type { ViewerContext } from '../profile/viewer-context.service';
import { row } from './__fixtures__';

const ANON: ViewerContext = { userId: null, profile: null };

function prismaWith(rows: ReturnType<typeof row>[]) {
  return {
    product: { findMany: jest.fn().mockResolvedValue(rows) },
    productComparison: { create: jest.fn().mockResolvedValue({}) },
  } as unknown as PrismaService;
}

describe('ComparisonService', () => {
  const match = new PersonalMatchService();

  it('refuses fewer than two or more than four products', async () => {
    const service = new ComparisonService(prismaWith([]), match);
    await expect(service.compare(['only-one'], ANON)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.compare(['a', 'b', 'c', 'd', 'e'], ANON)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps the caller’s column order', async () => {
    const rows = [row({ id: 'b' }), row({ id: 'a' })];
    const service = new ComparisonService(prismaWith(rows), match);
    const result = await service.compare(['a', 'b'], ANON);
    expect(result.products.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('normalises price by volume so different sizes compare fairly', async () => {
    const rows = [
      row({ id: 'big', price: 90, volume: 200 }), // 45 PLN / 100 ml
      row({ id: 'small', price: 40, volume: 50 }), // 80 PLN / 100 ml
    ];
    const service = new ComparisonService(prismaWith(rows), match);
    const result = await service.compare(['big', 'small'], ANON);

    const price = result.rows.find((r) => r.key === 'price')!;
    const perHundred = result.rows.find((r) => r.key === 'price-per-100')!;

    expect(price.bestIndex).toBe(1); // the small one is cheaper outright…
    expect(perHundred.bestIndex).toBe(0); // …but the big one is better value
  });

  it('declares no winner on a row where the values are identical', async () => {
    const rows = [row({ id: 'a', price: 50 }), row({ id: 'b', price: 50 })];
    const service = new ComparisonService(prismaWith(rows), match);
    const result = await service.compare(['a', 'b'], ANON);
    expect(result.rows.find((r) => r.key === 'price')!.bestIndex).toBeNull();
  });

  it('always reaches a verdict with reasons', async () => {
    const rows = [row({ id: 'a', price: 50, ingredientScore: 40 }), row({ id: 'b', price: 40, ingredientScore: 90 })];
    const service = new ComparisonService(prismaWith(rows), match);
    const result = await service.compare(['a', 'b'], ANON);

    expect(result.verdict).not.toBeNull();
    expect(result.verdict!.productId).toBe('b');
    expect(result.verdict!.summary).toMatch(/^Kosvia recommends /);
    expect(result.verdict!.reasons.length).toBeGreaterThan(1);
  });

  it('records the comparison for signed-in users only', async () => {
    const rows = [row({ id: 'a' }), row({ id: 'b' })];

    const anonPrisma = prismaWith(rows);
    await new ComparisonService(anonPrisma, match).compare(['a', 'b'], ANON);
    expect(anonPrisma.productComparison.create).not.toHaveBeenCalled();

    const userPrisma = prismaWith(rows);
    await new ComparisonService(userPrisma, match).compare(['a', 'b'], { userId: 'u1', profile: null });
    expect(userPrisma.productComparison.create).toHaveBeenCalled();
  });
});
