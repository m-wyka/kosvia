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
import en from '@@/i18n/locales/en.json';
import pl from '@@/i18n/locales/pl.json';
import { useVocabulary } from '@@/layers/core/app/composables/useVocabulary';
import { useFormat } from '@@/layers/core/app/composables/useFormat';
import { useMatchReason } from '@@/layers/core/app/composables/useMatchReason';
import { useLocalisedText } from '@@/layers/core/app/composables/useLocalisedText';
import BaseBadge from '@@/layers/core/app/components/base/BaseBadge.vue';
import BaseIcon from '@@/layers/core/app/components/base/BaseIcon.vue';
import BaseSkeleton from '@@/layers/core/app/components/base/BaseSkeleton.vue';
import BaseSpinner from '@@/layers/core/app/components/base/BaseSpinner.vue';
import IngredientBadge from '@@/layers/core/app/components/product/IngredientBadge.vue';
import PriceDisplay from '@@/layers/core/app/components/product/PriceDisplay.vue';
import ProductImage from '@@/layers/core/app/components/product/ProductImage.vue';

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
  const isFewForm =
    lastDigit >= 2 && lastDigit <= 4 && !(lastTwoDigits >= 12 && lastTwoDigits <= 14);
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
  defaultLocale: 'pl',
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
  useLocalePath: () => (path: string) => (activeLocale.value === 'pl' ? path : `/en${path}`),
  onKeyStroke: () => undefined,
});

Object.assign(globalThis, { useVocabulary, useFormat, useMatchReason, useLocalisedText });

const { useToast } = await import('@@/layers/core/app/composables/useToast');
Object.assign(globalThis, { useToast });

const comparisonIds = ref<string[]>([]);
const compareStoreStub = {
  items: comparisonIds,
  count: computed(() => comparisonIds.value.length),
  maxItems: computed(() => 4),
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
const signedIn = ref(false);
const premium = ref(false);
const authStoreStub = {
  user: ref(null),
  isAuthenticated: computed(() => signedIn.value),
  isAdmin: computed(() => false),
  isPremium: computed(() => premium.value),
  displayName: computed(() => 'there'),
};

export const setPremium = (value: boolean): void => {
  premium.value = value;
};

export const setSignedIn = (value: boolean): void => {
  signedIn.value = value;
};

type ApiHandler = (url: string, options?: { method?: string; body?: unknown }) => Promise<unknown>;

let apiHandler: ApiHandler = () => Promise.resolve(null);

export const setApiHandler = (handler: ApiHandler): void => {
  apiHandler = handler;
};

const stateByKey = new Map<string, ReturnType<typeof ref>>();

Object.assign(globalThis, {
  useState: <T>(key: string, init: () => T) => {
    if (!stateByKey.has(key)) {
      stateByKey.set(key, ref(init()));
    }
    return stateByKey.get(key);
  },
  useApi: () => (url: string, options?: { method?: string; body?: unknown }) =>
    apiHandler(url, options),
  useApiMessage: () => (error: unknown) => String(error),
});
const favoriteProductIds = ref<string[]>([]);
const shelfStub = {
  items: ref([]),
  busy: ref(false),
  productIds: computed(() => favoriteProductIds.value),
  favoriteIds: favoriteProductIds,
  refresh: () => Promise.resolve(),
  has: (id: string) => favoriteProductIds.value.includes(id),
  add: () => Promise.resolve(),
  remove: () => Promise.resolve(),
  toggleFavorite: (product: { id: string }) => {
    favoriteProductIds.value = favoriteProductIds.value.includes(product.id)
      ? favoriteProductIds.value.filter((entry) => entry !== product.id)
      : [...favoriteProductIds.value, product.id];
    return Promise.resolve();
  },
};

Object.assign(globalThis, {
  useCompareStore: () => compareStoreStub,
  useAuthStore: () => authStoreStub,
  useShelf: () => shelfStub,
});

const NuxtLinkStub = defineComponent({
  name: 'NuxtLinkLocale',
  props: { to: { type: [String, Object], default: '' } },
  setup:
    (props, { slots }) =>
    () =>
      h('a', { href: String(props.to) }, slots.default?.()),
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
  favoriteProductIds.value = [];
  activeLocale.value = 'en';
  signedIn.value = false;
  stateByKey.clear();
  apiHandler = () => Promise.resolve(null);
  useToast().clear();
};
