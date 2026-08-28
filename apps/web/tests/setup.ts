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

/**
 * The shared components are registered globally rather than stubbed, so a card
 * test actually asserts on the price the card renders — not on a placeholder.
 */
import BaseBadge from '../layers/core/app/components/base/BaseBadge.vue';
import BaseIcon from '../layers/core/app/components/base/BaseIcon.vue';
import BaseSkeleton from '../layers/core/app/components/base/BaseSkeleton.vue';
import BaseSpinner from '../layers/core/app/components/base/BaseSpinner.vue';
import IngredientBadge from '../layers/core/app/components/product/IngredientBadge.vue';
import PriceDisplay from '../layers/core/app/components/product/PriceDisplay.vue';
import ProductImage from '../layers/core/app/components/product/ProductImage.vue';

/**
 * Nuxt auto-imports `ref`, `computed`, `useId` and the app's own composables,
 * so components reference them as bare identifiers. Outside a Nuxt runtime
 * those identifiers resolve to globals — which is exactly what we install here.
 *
 * This keeps component tests fast and dependency-light while still exercising
 * the real `.vue` files rather than a re-implementation of them.
 */
const vueGlobals = {
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
};

Object.assign(globalThis, vueGlobals);

let idCounter = 0;
Object.assign(globalThis, {
  useId: () => `test-id-${idCounter++}`,
  useRoute: () => ({ path: '/', query: {}, params: {}, fullPath: '/' }),
  useRouter: () => ({ push: () => Promise.resolve(), replace: () => Promise.resolve() }),
  useRuntimeConfig: () => ({ public: { siteUrl: 'http://localhost:3000', siteName: 'Kosvia' } }),
  onKeyStroke: () => undefined,
});

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

/** `NuxtLink` renders as a plain anchor so href assertions stay meaningful. */
const NuxtLinkStub = defineComponent({
  name: 'NuxtLink',
  props: { to: { type: [String, Object], default: '' } },
  setup: (props, { slots }) => () => h('a', { href: String(props.to) }, slots.default?.()),
});

config.global.components = {
  NuxtLink: NuxtLinkStub,
  BaseBadge,
  BaseIcon,
  BaseSkeleton,
  BaseSpinner,
  IngredientBadge,
  PriceDisplay,
  ProductImage,
};
config.global.stubs = {
  ClientOnly: { template: '<div><slot /></div>' },
  Teleport: true,
};

export function resetTestGlobals(): void {
  comparisonIds.value = [];
}
