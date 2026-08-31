import { beforeEach, describe, expect, it } from 'vitest';
import en from '@@/i18n/locales/en.json';
import pl from '@@/i18n/locales/pl.json';
import { resetTestGlobals, setTestLocale } from '@@/tests/setup';

declare const useVocabulary: typeof import('@@/layers/core/app/composables/useVocabulary').useVocabulary;
declare const useMatchReason: typeof import('@@/layers/core/app/composables/useMatchReason').useMatchReason;
declare const useFormat: typeof import('@@/layers/core/app/composables/useFormat').useFormat;
declare const useLocalisedText: typeof import('@@/layers/core/app/composables/useLocalisedText').useLocalisedText;

const flatten = (node: Record<string, unknown>, prefix = ''): string[] =>
  Object.entries(node).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null
      ? flatten(value as Record<string, unknown>, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );

describe('locale files', () => {
  beforeEach(() => resetTestGlobals());

  it('carry exactly the same keys in both languages', () => {
    const enKeys = flatten(en).sort();
    const plKeys = flatten(pl).sort();
    expect(plKeys).toEqual(enKeys);
  });

  it('uses UPPER_SNAKE_CASE keys throughout', () => {
    const malformed = flatten(en).filter(
      (key) => !/^[A-Z][A-Z0-9_]*(\.[A-Z][A-Z0-9_]*)*$/.test(key),
    );
    expect(malformed).toEqual([]);
  });

  it('only leaves a value untranslated where Polish genuinely uses the same word', () => {
    const SAME_IN_BOTH = new Set([
      'COMMON.NOT_AVAILABLE',
      'LOCALE.EN',
      'LOCALE.PL',
      'NAV.ADMIN',
      'NAV.MENU',
      'VOCAB.TAG.RETINOID',
      'VOCAB.ROUTINE_STEP.SERUM',
      'LANDING.MATCH.DEMO_PRODUCT',
      'LANDING.PRICE.DEMO_TITLE',
      'LANDING.PRICING.EYEBROW',
      'LANDING.PRICING.PREMIUM.NAME',
      'LANDING.FAQ.EYEBROW',
      'SEARCH.FILTER.CRUELTY_FREE',
      'PRODUCT.PER_HUNDRED',
      'INGREDIENTS.INCI',
      'ADMIN.INCI_QUEUE.COL_TOKEN',
      'ADMIN.PRODUCTS.LABEL_PLACEHOLDER',
      'ADMIN.IMPORTS.COL_STATUS',
      'ABOUT_DATA.OBF_TITLE',
      'SEARCH.FILTER.WITH_COUNT',
      'ADMIN.AUDIT.SYSTEM',
      'PRODUCT.MATCH_BELOW_THRESHOLD',
      'ADMIN.MATCH_WEIGHTS.VERSION',
      'COMPARE.ROW.CRUELTY_FREE',
      'PROFILE.PREMIUM',
      'SCAN.PLACEHOLDER',
      'ADMIN.BADGE',
      'ADMIN.BRANDS.COL_SLUG',
      'ADMIN.BRANDS.FIELD_SLUG',
      'ADMIN.BRANDS.CRUELTY_FREE',
      'ADMIN.INGREDIENTS.COL_INCI',
      'ADMIN.PRODUCTS.COL_STATUS',
      'ADMIN.REVIEWS.COL_STATUS',
      'ADMIN.PRODUCTS.FIELD_SLUG',
      'ADMIN.PRODUCTS.FIELD_EAN',
      'ADMIN.STORES.FIELD_SLUG',
      'ADMIN.USERS.COL_PLAN',
      'ADMIN.USERS.PLAN.PREMIUM',
      'SEO.ADMIN.TITLE',
      'GENERATED.ROUTINE_STEP_NAME',
    ]);

    const read = (source: unknown, key: string) =>
      key
        .split('.')
        .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], source);

    const unexpected = flatten(en).filter(
      (key) => read(en, key) === read(pl, key) && !SAME_IN_BOTH.has(key),
    );

    expect(unexpected).toEqual([]);
  });
});

describe('sentences the API generated', () => {
  beforeEach(() => resetTestGlobals());

  it('translates a forwarded match reason, vocabulary params and all', () => {
    setTestLocale('pl');
    const localise = useLocalisedText();

    expect(
      localise({
        code: 'match:goals',
        text: 'Works towards hydration',
        params: { goals: ['hydration'] },
      }),
    ).toBe('Wspiera cele: nawilżenie');
  });

  it('translates its own namespace, formats money and picks a Polish plural', () => {
    setTestLocale('pl');
    const localise = useLocalisedText();

    expect(localise({ code: 'ai-available-from', text: '', params: { price: 24 } })).toBe(
      'Dostępny od 24,00 zł',
    );
    expect(localise({ code: 'ingredient-many-actives', text: '', params: { count: 5 } })).toMatch(
      /^5 składników aktywnych/,
    );
  });

  it('falls back to the API text for a code it does not know', () => {
    setTestLocale('pl');
    expect(useLocalisedText()({ code: 'something-new', text: 'Straight from the API.' })).toBe(
      'Straight from the API.',
    );
  });
});

describe('vocabulary translation', () => {
  beforeEach(() => resetTestGlobals());

  it('translates enum members and slugs on both sides', () => {
    const vocab = useVocabulary();
    expect(vocab.skinType('COMBINATION')).toBe('Combination');
    expect(vocab.category('eye-care')).toBe('Eye care');
    expect(vocab.tag('barrier-support')).toBe('Barrier support');

    setTestLocale('pl');
    const plVocab = useVocabulary();
    expect(plVocab.skinType('COMBINATION')).toBe('Mieszana');
    expect(plVocab.category('eye-care')).toBe('Pod oczy');
    expect(plVocab.tag('barrier-support')).toBe('Wsparcie bariery');
  });

  it('falls back to the API name for a slug it does not know', () => {
    const vocab = useVocabulary();
    expect(vocab.category('brand-new-category', 'Brand new category')).toBe('Brand new category');
  });
});

describe('match reasons', () => {
  beforeEach(() => resetTestGlobals());

  it('translates on the code and interpolates the params', () => {
    setTestLocale('pl');
    const reasonLabel = useMatchReason();

    expect(
      reasonLabel({
        code: 'concerns',
        label: 'Targets dehydration, redness',
        impact: 11,
        params: { concerns: ['dehydration', 'redness'] },
      }),
    ).toBe('Działa na: odwodnienie, zaczerwienienia');

    expect(
      reasonLabel({ code: 'budget-over', label: '', impact: -10, params: { budget: 100 } }),
    ).toBe('Znacznie powyżej Twojego budżetu 100 zł');
  });

  it('falls back to the English label for a code it has no translation for', () => {
    const reasonLabel = useMatchReason();
    expect(reasonLabel({ code: 'some-future-signal', label: 'Something new', impact: 4 })).toBe(
      'Something new',
    );
  });
});

describe('formatting', () => {
  beforeEach(() => resetTestGlobals());

  it("uses each locale's number and currency conventions", () => {
    expect(useFormat().price(59.99)).toBe('59.99 PLN');
    setTestLocale('pl');
    expect(useFormat().price(59.99)).toBe('59,99 zł');
  });
});
