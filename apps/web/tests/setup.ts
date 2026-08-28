import { config } from '@vue/test-utils';
import { storeToRefs } from 'pinia';
import {
  computed,
  defineComponent,
  h,
  nextTick,
  onMounted,
  onUnmounted,
  reactive,
  readonly,
  ref,
  shallowRef,
  toRef,
  watch,
  watchEffect,
} from 'vue';
import en from '../i18n/locales/en.json';
import pl from '../i18n/locales/pl.json';
import { useVocabulary } from '../layers/core/app/composables/useVocabulary';
import { useFormat } from '../layers/core/app/composables/useFormat';
import { useMatchReason } from '../layers/core/app/composables/useMatchReason';
import { useLocalisedText } from '../layers/core/app/composables/useLocalisedText';
import BaseBadge from '../layers/core/app/components/base/BaseBadge.vue';
import BaseIcon from '../layers/core/app/components/base/BaseIcon.vue';
import BaseSkeleton from '../layers/core/app/components/base/BaseSkeleton.vue';
import BaseSpinner from '../layers/core/app/components/base/BaseSpinner.vue';
import IngredientBadge from '../layers/core/app/components/product/IngredientBadge.vue';
import PriceDisplay from '../layers/core/app/components/product/PriceDisplay.vue';
import ProductImage from '../layers/core/app/components/product/ProductImage.vue';

type TestLocale = 'en' | 'pl';

const MESSAGES: Record<string, Record<string, unknown>> = { en, pl };
const POLISH_FORM_COUNT = 3;
const activeLocale = ref<TestLocale>('en');

const pluralIndex = (locale: string, count: number, formCount: number): number => {
  if (locale !== 'pl' || formCount < POLISH_FORM_COUNT) {
    return count === 1 ? 0 : 1;
  }
  if (count === 1) {
    return 0;
  }
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  const isFewForm = lastDigit >= 2 && lastDigit <= 4 && !(lastTwoDigits >= 12 && lastTwoDigits <= 14);
  return isFewForm ? 1 : 2;
};

const lookup = (locale: string, key: string): string | undefined => {
  const value = key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], MESSAGES[locale]);
  return typeof value === 'string' ? value : undefined;
};

const interpolate = (template: string, values: Record<string, unknown>): string => {
  return template
    .replace(/\{'([^']*)'\}/g, (_match, literal: string) => literal)
    .replace(/\{(\w+)\}/g, (match, name) => (name in values ? String(values[name]) : match));
};

const translate = (
  key: string,
  params?: Record<string, unknown> | number,
  plural?: number,
): string => {
  const locale = activeLocale.value;
  let template = lookup(locale, key) ?? lookup('en', key);
  if (template === undefined) {
    return key;
  }

  const count = typeof params === 'number' ? params : plural;
  if (typeof count === 'number' && template.includes('|')) {
    const forms = template.split('|').map((form) => form.trim());
    template = forms[pluralIndex(locale, count, forms.length)] ?? forms[0]!;
    if (typeof params === 'number') {
      return template.replace(/\{count\}/g, String(count));
    }
  }

  const values = (typeof params === 'object' && params !== null ? params : {}) as Record<
    string,
    unknown
  >;
  return interpolate(template, values);
};

export const setTestLocale = (locale: TestLocale): void => {
  activeLocale.value = locale;
};

const useI18nStub = () => ({
  t: translate,
  te: (key: string) => lookup(activeLocale.value, key) !== undefined,
  locale: activeLocale,
  locales: computed(() => [{ code: 'en' }, { code: 'pl' }]),
  defaultLocale: 'en',
});

Object.assign(globalThis, {
  ref,
  computed,
  reactive,
  readonly,
  shallowRef,
  toRef,
  watch,
  watchEffect,
  onMounted,
  onUnmounted,
  nextTick,
  storeToRefs,
  useI18n: useI18nStub,
});

let idCounter = 0;
Object.assign(globalThis, {
  useId: () => `test-id-${idCounter++}`,
  useRoute: () => ({ path: '/', query: {}, params: {}, fullPath: '/' }),
  useRouter: () => ({ push: () => Promise.resolve(), replace: () => Promise.resolve() }),
  useRuntimeConfig: () => ({ public: { siteUrl: 'http://localhost:3000', siteName: 'Kosvia' } }),
  useLocalePath: () => (path: string) => (activeLocale.value === 'en' ? path : `/pl${path}`),
  onKeyStroke: () => undefined,
});

Object.assign(globalThis, { useVocabulary, useFormat, useMatchReason, useLocalisedText });

const comparisonIds = ref<string[]>([]);
const compareStoreStub = {
  items: comparisonIds,
  count: computed(() => comparisonIds.value.length),
  MAX_ITEMS: 4,
  has: (id: string) => comparisonIds.value.includes(id),
  toggle: (product: { id: string }) => {
    comparisonIds.value = comparisonIds.value.includes(product.id)
      ? comparisonIds.value.filter((entry) => entry !== product.id)
      : [...comparisonIds.value, product.id];
    return 'added' as const;
  },
  remove: (id: string) => {
    comparisonIds.value = comparisonIds.value.filter((entry) => entry !== id);
  },
  clear: () => {
    comparisonIds.value = [];
  },
  hydrate: () => undefined,
};
const authStoreStub = {
  user: ref(null),
  isAuthenticated: computed(() => false),
  isAdmin: computed(() => false),
  displayName: computed(() => 'there'),
};
Object.assign(globalThis, {
  useCompareStore: () => compareStoreStub,
  useAuthStore: () => authStoreStub,
});

const NuxtLinkStub = defineComponent({
  name: 'NuxtLinkLocale',
  props: { to: { type: [String, Object], default: '' } },
  setup: (props, { slots }) => () => h('a', { href: String(props.to) }, slots.default?.()),
});

config.global.components = {
  NuxtLink: NuxtLinkStub,
  NuxtLinkLocale: NuxtLinkStub,
  BaseBadge,
  BaseIcon,
  BaseSkeleton,
  BaseSpinner,
  IngredientBadge,
  PriceDisplay,
  ProductImage,
};
config.global.mocks = { $t: translate };
config.global.stubs = {
  ClientOnly: { template: '<div><slot /></div>' },
  Teleport: true,
};

export const resetTestGlobals = (): void => {
  comparisonIds.value = [];
  activeLocale.value = 'en';
};
