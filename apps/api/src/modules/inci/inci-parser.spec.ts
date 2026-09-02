import { LABEL_FIXTURES } from './__fixtures__/labels';
import {
  extractParentheticals,
  joinHyphenatedToken,
  looseSeparatorKey,
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

describe('joinHyphenatedToken', () => {
  it.each([
    ['linalo - ol', 'linalool'],
    ['to - copherol', 'tocopherol'],
    ['citro - nellol', 'citronellol'],
    ['zinc sul - fate', 'zinc sulfate'],
    ['cel - lulose gum', 'cellulose gum'],
    ['poly - ester-8', 'polyester-8'],
    ['phenoxy- ethanol', 'phenoxyethanol'],
    ['phenoxy -ethanol', 'phenoxyethanol'],
  ])('rejoins a name the scanner broke across a line: %s', (token, expected) => {
    expect(joinHyphenatedToken(token)).toBe(expected);
  });

  it.each([
    'peg-100 stearate',
    'c12-15 alkyl benzoate',
    'alpha-isomethyl ionone',
    '1,2-hexanediol',
  ])('leaves a hyphen that belongs to the name alone: %s', (token) => {
    expect(joinHyphenatedToken(token)).toBeNull();
  });

  it('offers no candidate for a token without a spaced hyphen', () => {
    expect(joinHyphenatedToken('aqua')).toBeNull();
  });

  it('still only proposes for a genuine dash-separated list, which the caller rejects', () => {
    expect(joinHyphenatedToken('aqua - glycerin')).toBe('aquaglycerin');
  });
});

describe('looseSeparatorKey', () => {
  it.each([
    ['coco glucoside', 'coco-glucoside'],
    ['coco caprylate caprate', 'coco-caprylate/caprate'],
    ['beta carotene', 'beta-carotene'],
    ['polyglyceryl-3-polyricinoleate', 'polyglyceryl-3 polyricinoleate'],
    ['cocoglucoside', 'coco-glucoside'],
  ])('gives %s and its dictionary spelling the same key', (token, dictionaryName) => {
    expect(looseSeparatorKey(token)).toBe(looseSeparatorKey(dictionaryName));
  });

  it.each([
    ['sodium chloride', 'sodium citrate'],
    ['peg-100 stearate', 'peg-40 stearate'],
  ])('keeps genuinely different names apart: %s vs %s', (first, second) => {
    expect(looseSeparatorKey(first)).not.toBe(looseSeparatorKey(second));
  });

  it('leaves a name without separators untouched', () => {
    expect(looseSeparatorKey('niacinamide')).toBe('niacinamide');
  });
});

describe('foldToAscii homoglyphs', () => {
  it('recovers a Latin word that a scanner spelled with a Cyrillic lookalike', () => {
    expect(normalizeToken('\u0410qua')).toBe('aqua');
  });

  it('leaves an ordinary Latin token untouched', () => {
    expect(normalizeToken('Aqua')).toBe('aqua');
  });

  it('does not invent letters for genuinely foreign prose', () => {
    expect(normalizeToken('\uc0ac\uc6a9\uc744')).toBe('');
  });
});
