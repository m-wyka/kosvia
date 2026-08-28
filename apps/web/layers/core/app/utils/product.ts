import type { ProductSummaryDto } from '@kosvia/shared';

const DEFAULT_VOLUME_UNIT = 'ml';

export const fullProductName = (product: Pick<ProductSummaryDto, 'name' | 'brand'>): string => {
  return `${product.brand.name} ${product.name}`;
};

export const productPath = (product: Pick<ProductSummaryDto, 'slug'>): string => {
  return `/products/${product.slug}`;
};

export const formatVolume = (
  volume: number | null | undefined,
  unit: string | null | undefined,
): string | null => {
  if (!volume) {
    return null;
  }
  return `${volume} ${unit ?? DEFAULT_VOLUME_UNIT}`;
};
