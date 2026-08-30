import type { Prisma } from '@prisma/client';
import { MANUAL_SOURCE_CODE } from '../import/data-sources';
import type { ProductRow } from './product.select';

/**
 * HIDE_DEMO_DATA=true removes the seeded demo catalogue (source "manual" or no
 * source at all) from every public surface, leaving only imported products.
 * Admin routes query Prisma directly and keep seeing everything.
 */
const isDemoHidden = (): boolean => process.env.HIDE_DEMO_DATA === 'true';

export const publicProductWhere = (): Prisma.ProductWhereInput =>
  isDemoHidden()
    ? { isActive: true, source: { is: { code: { not: MANUAL_SOURCE_CODE } } } }
    : { isActive: true };

export const isProductVisible = (row: Pick<ProductRow, 'isActive' | 'source'>): boolean => {
  if (!row.isActive) {
    return false;
  }
  return !isDemoHidden() || (row.source !== null && row.source.code !== MANUAL_SOURCE_CODE);
};
