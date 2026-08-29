/**
 * Real-world label shapes the parser must survive. Add a case here for every
 * new edge seen in production — this file is the parser's regression suite.
 */

export interface LabelFixture {
  name: string;
  raw: string;
  expectedRaw: string[];
  expectedNormalized: string[];
  mayContainFrom?: number;
}

export const LABEL_FIXTURES: LabelFixture[] = [
  {
    name: 'comma separated with may-contain block',
    raw: 'Aqua, Glycerin, Cetearyl Alcohol, Ceramide NP, Niacinamide, Parfum (Fragrance), Sodium Hyaluronate, Phenoxyethanol, CI 77891, [+/- May Contain: Mica, CI 19140]',
    expectedRaw: [
      'Aqua',
      'Glycerin',
      'Cetearyl Alcohol',
      'Ceramide NP',
      'Niacinamide',
      'Parfum (Fragrance)',
      'Sodium Hyaluronate',
      'Phenoxyethanol',
      'CI 77891',
      'Mica',
      'CI 19140',
    ],
    expectedNormalized: [
      'aqua',
      'glycerin',
      'cetearyl alcohol',
      'ceramide np',
      'niacinamide',
      'parfum',
      'sodium hyaluronate',
      'phenoxyethanol',
      'ci 77891',
      'mica',
      'ci 19140',
    ],
    mayContainFrom: 10,
  },
  {
    name: 'uppercase with prefix, backslash synonyms and asterisk footnote',
    raw: 'INGREDIENTS: WATER\\AQUA\\EAU, GLYCERIN, DIMETHICONE, LINALOOL*, LIMONENE*\n* naturally occurring in essential oils',
    expectedRaw: ['WATER\\AQUA\\EAU', 'GLYCERIN', 'DIMETHICONE', 'LINALOOL', 'LIMONENE'],
    expectedNormalized: ['water aqua eau', 'glycerin', 'dimethicone', 'linalool', 'limonene'],
  },
  {
    name: 'common names in brackets',
    raw: 'Aqua (Water), Butyrospermum Parkii (Shea) Butter, Tocopheryl Acetate (Vitamin E)',
    expectedRaw: [
      'Aqua (Water)',
      'Butyrospermum Parkii (Shea) Butter',
      'Tocopheryl Acetate (Vitamin E)',
    ],
    expectedNormalized: ['aqua', 'butyrospermum parkii butter', 'tocopheryl acetate'],
  },
  {
    name: 'semicolon separated',
    raw: 'Aqua; Glycerin; Niacinamide',
    expectedRaw: ['Aqua', 'Glycerin', 'Niacinamide'],
    expectedNormalized: ['aqua', 'glycerin', 'niacinamide'],
  },
  {
    name: 'polish prefix, diacritics, hard spaces and OCR line breaks',
    raw: 'Skład: Aqua,  Glycerin,\r\nKwas Hialuronowy, Olej Słonecznikowy.',
    expectedRaw: ['Aqua', 'Glycerin', 'Kwas Hialuronowy', 'Olej Słonecznikowy'],
    expectedNormalized: ['aqua', 'glycerin', 'kwas hialuronowy', 'olej slonecznikowy'],
  },
  {
    name: 'CI number without space',
    raw: 'Aqua, CI77891, Ci 77491',
    expectedRaw: ['Aqua', 'CI77891', 'Ci 77491'],
    expectedNormalized: ['aqua', 'ci 77891', 'ci 77491'],
  },
  {
    name: 'single ingredient',
    raw: 'Simmondsia Chinensis (Jojoba) Seed Oil',
    expectedRaw: ['Simmondsia Chinensis (Jojoba) Seed Oil'],
    expectedNormalized: ['simmondsia chinensis seed oil'],
  },
  {
    name: 'empty string',
    raw: '',
    expectedRaw: [],
    expectedNormalized: [],
  },
  {
    name: 'prefix only',
    raw: 'Ingredients:',
    expectedRaw: [],
    expectedNormalized: [],
  },
  {
    name: 'comma inside brackets is not a separator',
    raw: 'Aqua, Parfum (Fragrance, Linalool), Glycerin',
    expectedRaw: ['Aqua', 'Parfum (Fragrance, Linalool)', 'Glycerin'],
    expectedNormalized: ['aqua', 'parfum', 'glycerin'],
  },
  {
    name: 'may contain in french with plus-minus outside brackets',
    raw: 'Aqua, Glycerin. +/- Peut contenir: CI 77491, CI 77492',
    expectedRaw: ['Aqua', 'Glycerin', 'CI 77491', 'CI 77492'],
    expectedNormalized: ['aqua', 'glycerin', 'ci 77491', 'ci 77492'],
    mayContainFrom: 3,
  },
  {
    name: 'comma inside a chemical locant is not a separator',
    raw: 'Aqua, 1,2-Hexanediol, Caprylyl Glycol, 2,3-Butanediol',
    expectedRaw: ['Aqua', '1,2-Hexanediol', 'Caprylyl Glycol', '2,3-Butanediol'],
    expectedNormalized: ['aqua', '1 2-hexanediol', 'caprylyl glycol', '2 3-butanediol'],
  },
  {
    name: 'trailing separator and double spaces',
    raw: 'Aqua,  Glycerin ,Niacinamide, ',
    expectedRaw: ['Aqua', 'Glycerin', 'Niacinamide'],
    expectedNormalized: ['aqua', 'glycerin', 'niacinamide'],
  },
];
