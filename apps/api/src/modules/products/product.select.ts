import { Prisma } from '@prisma/client';

/**
 * One canonical shape for product reads.
 *
 * The ingredient list is always loaded because Personal Match is computed from
 * it — a product row without ingredients cannot be scored. Concern/goal links
 * are selected as slugs only, which is all the scoring engine needs.
 */
/** Everything `toIngredientDto` needs on top of the ingredient row itself. */
export const INGREDIENT_INCLUDE = Prisma.validator<Prisma.IngredientInclude>()({
  targetsConcerns: { select: { slug: true } },
  supportsGoals: { select: { slug: true } },
  cosIngFunctions: { select: { function: { select: { name: true } } } },
});

export type IngredientRow = Prisma.IngredientGetPayload<{ include: typeof INGREDIENT_INCLUDE }>;

export const PRODUCT_INCLUDE = Prisma.validator<Prisma.ProductInclude>()({
  brand: true,
  category: true,
  source: { select: { code: true, name: true, license: true, attribution: true, url: true } },
  ingredients: {
    orderBy: { position: 'asc' },
    include: { ingredient: { include: INGREDIENT_INCLUDE } },
  },
  variants: {
    orderBy: [{ isDefault: 'desc' }, { volume: 'asc' }],
    include: {
      offers: {
        orderBy: { price: 'asc' },
        include: { store: true },
      },
    },
  },
});

export type ProductRow = Prisma.ProductGetPayload<{ include: typeof PRODUCT_INCLUDE }>;

export type ProductIngredientRow = ProductRow['ingredients'][number];
export type ProductVariantRow = ProductRow['variants'][number];
export type ProductOfferRow = ProductVariantRow['offers'][number];

/** A label entry that was matched to the ingredient dictionary. */
export type MatchedProductIngredientRow = ProductIngredientRow & {
  ingredientId: string;
  ingredient: NonNullable<ProductIngredientRow['ingredient']>;
};

export const hasMatchedIngredient = (
  entry: ProductIngredientRow,
): entry is MatchedProductIngredientRow => entry.ingredient !== null;
