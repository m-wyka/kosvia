import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import type { IngredientDto, ProductIngredientDto } from '@kosvia/shared';
import IngredientBadge from '../../layers/core/app/components/product/IngredientBadge.vue';
import IngredientList from '../../layers/core/app/components/product/IngredientList.vue';

const entry = (
  position: number,
  inciName: string,
  overrides: Partial<IngredientDto> = {},
): ProductIngredientDto => {
  return {
    position,
    concentrationRange: null,
    ingredient: {
      id: inciName.toLowerCase(),
      inciName,
      slug: inciName.toLowerCase().replace(/\s+/g, '-'),
      commonName: null,
      description: `About ${inciName}.`,
      functions: [],
      tags: [],
      concerns: null,
      comedogenicRating: null,
      sensitivityImpact: 0,
      goodForSkinTypes: [],
      targetsConcerns: [],
      supportsGoals: [],
      isActiveIngredient: false,
      casNumber: null,
      cosIngFunctions: [],
      regulatory: {
        isFragranceAllergen: false,
        isRestricted: false,
        isProhibited: false,
        annex: null,
        note: null,
      },
      ...overrides,
    } as IngredientDto,
  };
};

const INGREDIENTS: ProductIngredientDto[] = [
  entry(1, 'Aqua', { tags: ['solvent'] }),
  entry(2, 'Glycerin', { tags: ['humectant'] }),
  entry(3, 'Niacinamide', { tags: ['brightening'], isActiveIngredient: true }),
  entry(4, 'Centella Asiatica Extract', { tags: ['soothing'] }),
  entry(5, 'Parfum', { tags: ['fragrance'], concerns: 'A common source of reactions.' }),
];

describe('IngredientList', () => {
  const mountList = () => mount(IngredientList, { props: { ingredients: INGREDIENTS } });

  it('groups ingredients by what they do', () => {
    const text = mountList().text();
    expect(text).toContain('Active ingredients');
    expect(text).toContain('Hydration & barrier');
    expect(text).toContain('Soothing & antioxidant');
    expect(text).toContain('Fragrance');
    expect(text).toContain('Base & formulation');
  });

  it('places every ingredient in exactly one group', () => {
    const text = mountList().text();
    for (const name of ['Aqua', 'Glycerin', 'Niacinamide', 'Parfum']) {
      const occurrences = text.split(name).length - 1;
      expect(occurrences, `${name} appeared ${occurrences} times`).toBe(1);
    }
  });

  it('shows the label position, because position implies concentration', () => {
    const list = mountList();
    expect(list.findAll('li button[aria-expanded]').length).toBe(INGREDIENTS.length);
    const positions = list.findAll('li button[aria-expanded] > span:first-child');
    expect(positions.map((node) => node.text())).toEqual(['3', '2', '4', '5', '1']);
  });

  it('reveals the description and any caution note when a row is expanded', async () => {
    const list = mountList();
    const parfumRow = list
      .findAll('li button[aria-expanded]')
      .find((button) => button.text().includes('Parfum'))!;
    await parfumRow.trigger('click');
    expect(list.text()).toContain('About Parfum.');
    expect(list.text()).toContain('A common source of reactions.');
  });

  it('never labels an ingredient toxic, dangerous or bad', () => {
    expect(mountList().text()).not.toMatch(/toxic|dangerous|harmful|\bbad\b/i);
  });

  it('keeps the full ordered INCI list available behind a disclosure', async () => {
    const list = mountList();
    expect(list.text()).toContain('Full INCI list, in label order');
    const toggle = list
      .findAll('button')
      .find((button) => button.text().includes('Full INCI list'))!;
    await toggle.trigger('click');
    expect(list.text()).toContain('Aqua, Glycerin, Niacinamide, Centella Asiatica Extract, Parfum');
  });
});

describe('IngredientBadge', () => {
  it('translates machine tags into plain language', () => {
    expect(mount(IngredientBadge, { props: { tag: 'humectant' } }).text()).toBe('Hydrating');
    expect(mount(IngredientBadge, { props: { tag: 'barrier-support' } }).text()).toBe(
      'Barrier support',
    );
    expect(mount(IngredientBadge, { props: { tag: 'surfactant' } }).text()).toBe('Cleansing');
  });

  it('falls back to a readable form for an unknown tag', () => {
    expect(mount(IngredientBadge, { props: { tag: 'some-new-tag' } }).text()).toBe('some new tag');
  });
});
