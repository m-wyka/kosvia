import { dedupeRepeatedLabel, mapObfProduct, parseQuantity, type SkipReason } from './obf-mapper';
import type { OpenBeautyFactsProduct } from './obf-types';

const complete: OpenBeautyFactsProduct = {
  code: '5906721183488',
  product_name: 'Divine Cream Face & Eyes',
  brands: 'SAMARITÉ ORIGINAL, Samarite',
  categories_tags: ['en:face', 'en:facial-creams'],
  ingredients_text: 'Aqua, Glycerin, Niacinamide, Phenoxyethanol',
  image_url:
    'https://images.openbeautyfacts.org/images/products/590/672/118/3488/front_pl.6.400.jpg',
  quantity: '15 ml',
  last_modified_t: 1787116654,
};

describe('mapObfProduct', () => {
  it('maps a complete record', () => {
    const mapped = mapObfProduct(complete);
    expect(mapped.kind).toBe('product');
    if (mapped.kind !== 'product') {
      return;
    }
    expect(mapped.product).toEqual({
      ean: '5906721183488',
      name: 'Divine Cream Face & Eyes',
      brandName: 'SAMARITÉ ORIGINAL',
      categorySlug: 'moisturizers',
      rawLabel: 'Aqua, Glycerin, Niacinamide, Phenoxyethanol',
      imageUrl: complete.image_url,
      volume: 15,
      volumeUnit: 'ml',
      sourceUpdatedAt: new Date(1787116654 * 1000),
    });
  });

  it('prefers the most specific category tag', () => {
    const mapped = mapObfProduct({
      ...complete,
      categories_tags: ['en:suncare', 'en:face', 'en:facial-creams', 'en:facial-sunscreens'],
    });
    expect(mapped.kind === 'product' && mapped.product.categorySlug).toBe('sun-care');
  });

  it('prefers the Polish name and label when present', () => {
    const mapped = mapObfProduct({
      ...complete,
      product_name_pl: 'Krem boski',
      ingredients_text_pl: 'Aqua, Glycerin, Niacinamide, Tocopherol',
    });
    expect(mapped.kind === 'product' && mapped.product.name).toBe('Krem boski');
    expect(mapped.kind === 'product' && mapped.product.rawLabel).toBe(
      'Aqua, Glycerin, Niacinamide, Tocopherol',
    );
  });

  const skipCases: Array<[Partial<OpenBeautyFactsProduct>, SkipReason]> = [
    [{ code: '12' }, 'invalid-ean'],
    [{ product_name: '' }, 'missing-name'],
    [{ brands: ' ' }, 'missing-brand'],
    [{ ingredients_text: 'Aqua' }, 'missing-ingredients'],
    [{ categories_tags: ['en:lipsticks'] }, 'unmapped-category'],
  ];

  it.each(skipCases)('skips %j as %s', (patch, reason) => {
    expect(mapObfProduct({ ...complete, ...patch })).toEqual({
      kind: 'skip',
      reason,
      ean: patch.code ?? complete.code,
    });
  });
});

describe('dedupeRepeatedLabel', () => {
  it('keeps the later, complete copy of a doubled label', () => {
    const doubled =
      'Aqua (Water), Octocrylene, Ethylhexyl Methoxycinnamate, Glycerin, C12-15 AlkylAqua (Water), Octocrylene, Ethylhexyl Methoxycinnamate, Glycerin, C12-15 Alkyl Benzoate, Phenoxyethanol';
    expect(dedupeRepeatedLabel(doubled)).toBe(
      'Aqua (Water), Octocrylene, Ethylhexyl Methoxycinnamate, Glycerin, C12-15 Alkyl Benzoate, Phenoxyethanol',
    );
  });

  it('leaves a normal label alone', () => {
    const label = 'Aqua, Glycerin, Niacinamide, Sodium Hyaluronate, Phenoxyethanol';
    expect(dedupeRepeatedLabel(label)).toBe(label);
  });
});

describe('parseQuantity', () => {
  it.each([
    ['15 ml', 15, 'ml'],
    ['200ml', 200, 'ml'],
    ['50 g', 50, 'g'],
    ['1 l', 1000, 'ml'],
    ['1,5 L', 1500, 'ml'],
    ['2 x 100 ml', 2, null],
    ['1.7 fl oz', 1.7, 'fl oz'],
    [undefined, null, null],
    ['big', null, null],
  ])('parses %p', (input, volume, unit) => {
    const parsed = parseQuantity(input);
    if (input === '2 x 100 ml') {
      expect(parsed.volume).toBe(100);
      return;
    }
    expect(parsed).toEqual({ volume, volumeUnit: unit });
  });
});
