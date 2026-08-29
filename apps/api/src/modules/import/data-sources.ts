import type { Prisma } from '@prisma/client';

export const MANUAL_SOURCE_CODE = 'manual';
export const OPEN_BEAUTY_FACTS_SOURCE_CODE = 'openbeautyfacts';

/**
 * The provenance rows every environment needs. Seeded, and upserted again by
 * each importer before it writes, so a fresh database never lacks them.
 */
export const DATA_SOURCES: Prisma.DataSourceCreateManyInput[] = [
  {
    code: MANUAL_SOURCE_CODE,
    name: 'Kosvia',
    license: 'own',
    attribution: null,
    url: null,
  },
  {
    code: OPEN_BEAUTY_FACTS_SOURCE_CODE,
    name: 'Open Beauty Facts',
    license: 'ODbL',
    attribution:
      'Product data from Open Beauty Facts, made available under the Open Database License (ODbL). Individual contents are licensed under the Database Contents License.',
    url: 'https://world.openbeautyfacts.org',
  },
];
