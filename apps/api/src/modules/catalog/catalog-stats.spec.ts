import { CatalogService } from './catalog.service';
import type { PrismaService } from '../../common/prisma/prisma.service';

const buildService = (counts: { products: number; ingredients: number; allergens: number }) => {
  const productCount = jest.fn(() => Promise.resolve(counts.products));
  const ingredientCount = jest
    .fn()
    .mockImplementation(({ where }: { where?: Record<string, unknown> } = {}) =>
      Promise.resolve(where?.isFragranceAllergen ? counts.allergens : counts.ingredients),
    );
  const prisma = {
    product: { count: productCount },
    ingredient: { count: ingredientCount },
    $transaction: jest.fn((operations: Promise<number>[]) => Promise.all(operations)),
  };
  const service = new CatalogService(prisma as unknown as PrismaService);
  return { service, prisma };
};

describe('CatalogService.stats', () => {
  it('rounds products down to hundreds and ingredients down to thousands', async () => {
    const { service } = buildService({ products: 1222, ingredients: 32848, allergens: 65 });

    await expect(service.stats()).resolves.toEqual({
      analysedProducts: 1200,
      knownIngredients: 32000,
      fragranceAllergens: 65,
    });
  });

  it('keeps the fragrance allergen count exact', async () => {
    const { service } = buildService({ products: 100, ingredients: 1000, allergens: 3 });

    await expect(service.stats()).resolves.toMatchObject({ fragranceAllergens: 3 });
  });

  it('serves repeated calls from the cache without touching the database again', async () => {
    const { service, prisma } = buildService({ products: 1222, ingredients: 32848, allergens: 65 });

    await service.stats();
    await service.stats();

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
