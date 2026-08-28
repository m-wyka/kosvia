import type { ProductSummaryDto } from '@kosvia/shared';

/** "Brand Product" — the name we show wherever a product is referred to in prose. */
export function fullProductName(product: Pick<ProductSummaryDto, 'name' | 'brand'>): string {
  return `${product.brand.name} ${product.name}`;
}

export function productPath(product: Pick<ProductSummaryDto, 'slug'>): string {
  return `/products/${product.slug}`;
}

/** Size label, e.g. "50 ml". */
export function formatVolume(
  volume: number | null | undefined,
  unit: string | null | undefined,
): string | null {
  if (!volume) return null;
  return `${volume} ${unit ?? 'ml'}`;
}
