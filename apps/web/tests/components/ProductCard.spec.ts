import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import type { ProductSummaryDto } from '@kosvia/shared';
import { resetTestGlobals, setTestLocale } from '@@/tests/setup';
import ProductCard from '@@/layers/core/app/components/product/ProductCard.vue';

const product = (overrides: Partial<ProductSummaryDto> = {}): ProductSummaryDto => ({
  id: 'p1',
  ean: null,
  name: 'Ceramide Barrier Cream',
  slug: 'kalme-ceramide-barrier-cream',
  imageUrl: '/img/product/kalme-ceramide-barrier-cream.svg',
  volume: 50,
  volumeUnit: 'ml',
  isFragranceFree: true,
  isVegan: true,
  isCrueltyFree: true,
  brand: { id: 'b1', name: 'Kalmé', slug: 'kalme', logo: null },
  category: {
    id: 'c1',
    name: 'Moisturizers',
    slug: 'moisturizers',
    parentId: null,
    description: null,
  },
  lowestPrice: 59.99,
  lowestPriceStore: {
    id: 's1',
    name: 'Demo Drogeria',
    slug: 'demo-drogeria',
    logo: null,
    websiteUrl: null,
  },
  ingredientScore: 82,
  personalMatch: {
    score: 92,
    tier: 'perfect',
    reasons: [{ code: 'concerns', label: 'Targets dehydration', impact: 11 }],
    warnings: [],
    personalised: true,
  },
  ...overrides,
});

describe('ProductCard', () => {
  beforeEach(() => {
    resetTestGlobals();
  });

  it('shows brand, name, price and match — the four things a card is for', async () => {
    const component = mount(ProductCard, { props: { product: product() } });
    const text = component.text();
    expect(text).toContain('Kalmé');
    expect(text).toContain('Ceramide Barrier Cream');
    expect(text).toContain('59.99 PLN');
    expect(text).toContain('92% match');
  });

  it('renders in Polish when the locale changes', () => {
    setTestLocale('pl');
    const component = mount(ProductCard, { props: { product: product() } });
    const text = component.text();

    expect(text).toContain('59,99 zł');
    expect(text).toContain('92% dopasowania');
    expect(text).toContain('Bezzapachowe');
  });

  it('translates the favourite control label', () => {
    setTestLocale('pl');
    const component = mount(ProductCard, { props: { product: product() } });
    expect(component.get('[aria-pressed]').attributes('aria-label')).toBe(
      'Dodaj Ceramide Barrier Cream do ulubionych',
    );
  });

  it('links to the product page by slug', async () => {
    const component = mount(ProductCard, { props: { product: product() } });
    expect(component.find('a').attributes('href')).toBe('/products/kalme-ceramide-barrier-cream');
  });

  it('labels the favourite control by product name and state', async () => {
    const component = mount(ProductCard, { props: { product: product() } });
    const button = component.get('[aria-pressed]');
    expect(button.attributes('aria-label')).toContain('Ceramide Barrier Cream');
    expect(button.attributes('aria-pressed')).toBe('false');
  });

  it('emits the product when the favourite control is used', async () => {
    const component = mount(ProductCard, { props: { product: product() } });
    await component.get('[aria-pressed]').trigger('click');
    expect(component.emitted('favorite')?.[0]?.[0]).toMatchObject({ id: 'p1' });
  });

  it('shows the alternative reason instead of tags when one is given', async () => {
    const component = mount(ProductCard, {
      props: { product: product(), note: '43% less than the product you are viewing' },
    });
    expect(component.text()).toContain('43% less');
    expect(component.text()).not.toContain('Fragrance-free');
  });

  it('handles a product with no price without rendering a broken figure', async () => {
    const component = mount(ProductCard, {
      props: { product: product({ lowestPrice: null, lowestPriceStore: null }) },
    });
    expect(component.text()).toContain('Price unavailable');
  });
});
