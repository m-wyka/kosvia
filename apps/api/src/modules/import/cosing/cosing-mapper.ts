import type { IngredientTag } from '@kosvia/shared';
import { slugify } from '@kosvia/shared';
import { normalizeToken } from '../../inci/inci-parser';
import type { CosIngIngredientRecord } from './cosing-types';

/**
 * CosIng functions that map cleanly onto Kosvia's scoring tags. Everything
 * else (SKIN CONDITIONING, HAIR CONDITIONING, …) is too broad to carry a
 * score signal and is kept only as a function link.
 */
const FUNCTION_TAGS: Record<string, IngredientTag> = {
  HUMECTANT: 'humectant',
  EMOLLIENT: 'emollient',
  ANTIOXIDANT: 'antioxidant',
  PRESERVATIVE: 'preservative',
  PERFUMING: 'fragrance',
  'UV FILTER': 'uv-filter',
  'UV ABSORBER': 'uv-filter',
  SOLVENT: 'solvent',
  'VISCOSITY CONTROLLING': 'thickener',
  EMULSIFYING: 'emulsifier',
  BUFFERING: 'ph-adjuster',
  'COSMETIC COLORANT': 'colorant',
  EXFOLIATING: 'exfoliant',
  SOOTHING: 'soothing',
  'SKIN PROTECTING': 'barrier-support',
  BLEACHING: 'brightening',
  'SURFACTANT - CLEANSING': 'surfactant',
  'SURFACTANT - FOAM BOOSTING': 'surfactant',
  'SURFACTANT - EMULSIFYING': 'emulsifier',
  'SURFACTANT - SOLUBILIZING': 'surfactant',
  'SURFACTANT - DISPERSING': 'surfactant',
  'SURFACTANT - HYDROTROPE': 'surfactant',
};

export const functionCode = (name: string): string =>
  name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

export const tagsForFunctions = (functionNames: string[]): IngredientTag[] => [
  ...new Set(
    functionNames.flatMap((name) => {
      const tag = FUNCTION_TAGS[name.toUpperCase().trim()];
      return tag ? [tag] : [];
    }),
  ),
];

export interface NormalizedIngredient {
  cosIngRef: string;
  inciName: string;
  normalizedName: string;
  slug: string;
  innName: string | null;
  casNumber: string | null;
  ecNumber: string | null;
  chemicalDescription: string | null;
  functionCodes: string[];
  tags: IngredientTag[];
}

export type MappedIngredient =
  | { kind: 'ingredient'; ingredient: NormalizedIngredient }
  | { kind: 'skip'; reason: 'inactive' | 'perfuming-name' | 'unnormalizable' };

/** CosIng shouts in capitals; labels and the seed use title case, so we do too. */
export const toTitleCase = (inciName: string): string =>
  inciName
    .toLowerCase()
    .replace(
      /(^|[\s(/-])([a-z])/g,
      (_, boundary: string, letter: string) => boundary + letter.toUpperCase(),
    )
    .replace(/\bCi (\d{5})\b/g, 'CI $1');

export const mapCosIngIngredient = (record: CosIngIngredientRecord): MappedIngredient => {
  if (!record.isActive) {
    return { kind: 'skip', reason: 'inactive' };
  }
  if (record.isPerfumingName) {
    return { kind: 'skip', reason: 'perfuming-name' };
  }
  const normalizedName = normalizeToken(record.inciName);
  if (!normalizedName) {
    return { kind: 'skip', reason: 'unnormalizable' };
  }
  const inciName = toTitleCase(record.inciName);
  return {
    kind: 'ingredient',
    ingredient: {
      cosIngRef: record.cosIngRef,
      inciName,
      normalizedName,
      slug: slugify(inciName),
      innName: record.innName,
      casNumber: record.casNumber,
      ecNumber: record.ecNumber,
      chemicalDescription: record.chemicalDescription,
      functionCodes: [...new Set(record.functionNames.map(functionCode))],
      tags: tagsForFunctions(record.functionNames),
    },
  };
};
