import { LABEL_FIXTURES } from './__fixtures__/labels';
import {
  extractParentheticals,
  normalizeToken,
  parseLabel,
  splitFragments,
  tokenize,
} from './inci-parser';

describe('parseLabel', () => {
  it.each(LABEL_FIXTURES)(
    'handles $name',
    ({ raw, expectedRaw, expectedNormalized, mayContainFrom }) => {
      const parsed = parseLabel(raw);
      expect(parsed.tokens.map((token) => token.rawText)).toEqual(expectedRaw);
      expect(parsed.tokens.map((token) => token.normalized)).toEqual(expectedNormalized);
      expect(parsed.tokens.map((token) => token.position)).toEqual(
        expectedRaw.map((_, index) => index + 1),
      );
      parsed.tokens.forEach((token) => {
        expect(token.isAfterMayContain).toBe(
          mayContainFrom !== undefined && token.position >= mayContainFrom,
        );
      });
      expect(parsed.hasMayContainSection).toBe(mayContainFrom !== undefined);
    },
  );
});

describe('tokenize', () => {
  it('splits on commas and semicolons outside brackets only', () => {
    expect(tokenize('A, B (c, d); E [f; g]')).toEqual(['A', 'B (c, d)', 'E [f; g]']);
  });

  it('survives unbalanced closing brackets', () => {
    expect(tokenize('A), B')).toEqual(['A)', 'B']);
  });
});

describe('normalizeToken', () => {
  it('folds diacritics and case', () => {
    expect(normalizeToken('Olej Słonecznikowy')).toBe('olej slonecznikowy');
    expect(normalizeToken('Crème')).toBe('creme');
  });

  it('drops bracketed common names', () => {
    expect(normalizeToken('Butyrospermum Parkii (Shea) Butter')).toBe(
      'butyrospermum parkii butter',
    );
  });

  it('canonicalises CI numbers', () => {
    expect(normalizeToken('CI77891')).toBe('ci 77891');
    expect(normalizeToken('ci  19140')).toBe('ci 19140');
  });
});

describe('splitFragments', () => {
  it('splits slash synonyms into separate lookups', () => {
    expect(splitFragments('WATER\\AQUA\\EAU')).toEqual(['water', 'aqua', 'eau']);
    expect(splitFragments('Aqua / Water')).toEqual(['aqua', 'water']);
  });

  it('keeps a slash-free token whole', () => {
    expect(splitFragments('Cetearyl Alcohol')).toEqual(['cetearyl alcohol']);
  });

  it('ignores slashes inside brackets', () => {
    expect(splitFragments('Aqua (Water/Eau)')).toEqual(['aqua']);
  });
});

describe('extractParentheticals', () => {
  it('collects alias candidates', () => {
    expect(extractParentheticals('Tocopheryl Acetate (Vitamin E)')).toEqual(['Vitamin E']);
    expect(extractParentheticals('Aqua')).toEqual([]);
  });
});
