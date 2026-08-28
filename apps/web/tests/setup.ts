import { config } from '@vue/test-utils';
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

/**
 * The real vocabulary/format/reason composables, so tests exercise the same
 * translation path the app does.
 */
import { useVocabulary } from '../layers/core/app/composables/useVocabulary';
import { useFormat } from '../layers/core/app/composables/useFormat';
import { useMatchReason } from '../layers/core/app/composables/useMatchReason';
import { useLocalisedText } from '../layers/core/app/composables/useLocalisedText';

/**
 * The shared components are registered globally rather than stubbed, so a card
 * test asserts on the price the card renders — not on a placeholder.
 */
import BaseBadge from '../layers/core/app/components/base/BaseBadge.vue';
import BaseIcon from '../layers/core/app/components/base/BaseIcon.vue';
import BaseSkeleton from '../layers/core/app/components/base/BaseSkeleton.vue';
import BaseSpinner from '../layers/core/app/components/base/BaseSpinner.vue';
import IngredientBadge from '../layers/core/app/components/product/IngredientBadge.vue';
import PriceDisplay from '../layers/core/app/components/product/PriceDisplay.vue';
import ProductImage from '../layers/core/app/components/product/ProductImage.vue';

/**
 * Nuxt auto-imports `ref`, `computed`, `useI18n` and the app's own composables,
 * so components reference them as bare identifiers. Outside a Nuxt runtime
 * those identifiers resolve to globals — which is what we install here.
 *
 * Translations are the real locale files rather than stubs: a test asserting on
 * "Fragrance-free" should fail if that key is deleted, and the Polish tests
 * would be meaningless against a passthrough `t`.
 */

const MESSAGES: Record<string, Record<string, unknown>> = { en, pl };
const activeLocale = ref<'en' | 'pl'>('en');

/** Mirrors the Polish plural rule registered in i18n/i18n.config.ts. */
function pluralIndex(locale: string, count: number, forms: number): number {
  if (locale !== 'pl' || forms < 3) return count === 1 ? 0 : 1;
  if (count === 1) return 0;
  const last = count % 10;
  const lastTwo = count % 100;
  return last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14) ? 1 : 2;
}

function lookup(locale: string, key: string): string | undefined {
  const value = key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], MESSAGES[locale]);
  return typeof value === 'string' ? value : undefined;
}

function translate(
  key: string,
  params?: Record<string, unknown> | number,
  plural?: number,
): string {
  const locale = activeLocale.value;
  let template = lookup(locale, key) ?? lookup('en', key);
  if (template === undefined) return key;

  // vue-i18n takes the count either on its own — t(key, 3) — or after the
  // named params, as t(key, params, 3).
  const count = typeof params === 'number' ? params : plural;
  if (typeof count === 'number' && template.includes('|')) {
    const forms = template.split('|').map((form) => form.trim());
    template = forms[pluralIndex(locale, count, forms.length)] ?? forms[0]!;
    if (typeof params === 'number') return template.replace(/\{count\}/g, String(count));
  }

  const values = (typeof params === 'object' && params !== null ? params : {}) as Record<
    string,
    unknown
  >;
  return template
    // Literal interpolation, e.g. {'@'} — vue-i18n's escape for reserved characters.
    .replace(/\{'([^']*)'\}/g, (_match, literal: string) => literal)
    .replace(/\{(\w+)\}/g, (match, name) => (name in values ? String(values[name]) : match));
}

export function setTestLocale(locale: 'en' | 'pl'): void {
  activeLocale.value = locale;
}

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

/** A minimal comparison tray, so cards can be mounted without Pinia. */
const comparisonIds = ref<string[]>([]);
Object.assign(globalThis, {
  useCompareStore: () => ({
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
  }),
  useAuthStore: () => ({
    user: ref(null),
    isAuthenticated: computed(() => false),
    isAdmin: computed(() => false),
    displayName: computed(() => 'there'),
  }),
});

/** `NuxtLinkLocale` renders as a plain anchor so href assertions stay meaningful. */
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

export function resetTestGlobals(): void {
  comparisonIds.value = [];
  activeLocale.value = 'en';
}
