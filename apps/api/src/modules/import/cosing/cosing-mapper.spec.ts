import { functionCode, mapCosIngIngredient, tagsForFunctions, toTitleCase } from './cosing-mapper';
import type { CosIngIngredientRecord } from './cosing-types';

const record = (overrides: Partial<CosIngIngredientRecord> = {}): CosIngIngredientRecord => ({
  cosIngRef: '79433',
  inciName: 'POTASSIUM ALUMINUM POLYACRYLATE',
  innName: null,
  casNumber: '67785-56-2',
  ecNumber: null,
  chemicalDescription: '2-Propenoic acid, homopolymer, aluminum potassium salt',
  functionNames: ['ABSORBENT', 'VISCOSITY CONTROLLING'],
  isPerfumingName: false,
  isActive: true,
  ...overrides,
});

describe('mapCosIngIngredient', () => {
  it('normalises the name the same way the label matcher does', () => {
    const mapped = mapCosIngIngredient(record());
    expect(mapped).toMatchObject({
      kind: 'ingredient',
      ingredient: {
        inciName: 'Potassium Aluminum Polyacrylate',
        normalizedName: 'potassium aluminum polyacrylate',
        slug: 'potassium-aluminum-polyacrylate',
        functionCodes: ['ABSORBENT', 'VISCOSITY_CONTROLLING'],
        tags: ['thickener'],
      },
    });
  });

  it('skips perfuming names and withdrawn entries', () => {
    expect(mapCosIngIngredient(record({ isPerfumingName: true }))).toEqual({
      kind: 'skip',
      reason: 'perfuming-name',
    });
    expect(mapCosIngIngredient(record({ isActive: false }))).toEqual({
      kind: 'skip',
      reason: 'inactive',
    });
  });
});

describe('tagsForFunctions', () => {
  it('maps only functions with a clear scoring meaning', () => {
    expect(tagsForFunctions(['SKIN CONDITIONING', 'HUMECTANT', 'PERFUMING'])).toEqual([
      'humectant',
      'fragrance',
    ]);
    expect(tagsForFunctions(['SURFACTANT - CLEANSING', 'SURFACTANT - FOAM BOOSTING'])).toEqual([
      'surfactant',
    ]);
  });
});

describe('toTitleCase', () => {
  it('keeps CI numbers and hyphenated parts readable', () => {
    expect(toTitleCase('CI 77891')).toBe('CI 77891');
    expect(toTitleCase('ALPHA-ISOMETHYL IONONE')).toBe('Alpha-Isomethyl Ionone');
    expect(toTitleCase('PEG-40 HYDROGENATED CASTOR OIL')).toBe('Peg-40 Hydrogenated Castor Oil');
  });
});

describe('functionCode', () => {
  it('turns CosIng names into stable codes', () => {
    expect(functionCode('Surfactant - Foam Boosting')).toBe('SURFACTANT_FOAM_BOOSTING');
  });
});
