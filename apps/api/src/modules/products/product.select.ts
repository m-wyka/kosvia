import { Prisma } from '@prisma/client';

/**
 * One canonical shape for product reads.
 *
 * The ingredient list is always loaded because Personal Match is computed from
 * it — a product row without ingredients cannot be scored. Concern/goal links
 * are selected as slugs only, which is all the scoring engine needs.
 */
export const PRODUCT_INCLUDE = Prisma.validator<Prisma.ProductInclude>()({
  brand: true,
  category: true,
  ingredients: {
    orderBy: { position: 'asc' },
    include: {
      ingredient: {
        include: {
          targetsConcerns: { select: { slug: true } },
          supportsGoals: { select: { slug: true } },
        },
      },
    },
  },
  offers: {
    orderBy: { price: 'asc' },
    include: { store: true },
  },
});

export type ProductRow = Prisma.ProductGetPayload<{ include: typeof PRODUCT_INCLUDE }>;
