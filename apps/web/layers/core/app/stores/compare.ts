import { defineStore } from 'pinia';
import { PLAN_LIMITS, type ProductSummaryDto } from '@kosvia/shared';

const MIN_ITEMS_TO_COMPARE = 2;
const STORAGE_KEY = 'kosvia:compare';

export const useCompareStore = defineStore('compare', () => {
  const items = ref<ProductSummaryDto[]>([]);
  const hydrated = ref(false);

  const { isPremium } = storeToRefs(useAuthStore());

  const maxItems = computed(
    () => PLAN_LIMITS[isPremium.value ? 'PREMIUM' : 'FREE'].compareProducts,
  );
  const count = computed(() => items.value.length);
  const isFull = computed(() => items.value.length >= maxItems.value);
  const canCompare = computed(() => items.value.length >= MIN_ITEMS_TO_COMPARE);
  const compareLink = computed(
    () => `/compare?products=${items.value.map((item) => item.slug).join(',')}`,
  );

  const persist = (): void => {
    if (!import.meta.client) {
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items.value));
    } catch {
      return;
    }
  };

  const has = (productId: string): boolean => {
    return items.value.some((item) => item.id === productId);
  };

  const toggle = (product: ProductSummaryDto): 'added' | 'removed' | 'full' => {
    if (has(product.id)) {
      items.value = items.value.filter((item) => item.id !== product.id);
      persist();
      return 'removed';
    }
    if (isFull.value) {
      return 'full';
    }
    items.value = [...items.value, product];
    persist();
    return 'added';
  };

  const remove = (productId: string): void => {
    items.value = items.value.filter((item) => item.id !== productId);
    persist();
  };

  const clear = (): void => {
    items.value = [];
    persist();
  };

  const hydrate = (): void => {
    if (hydrated.value || !import.meta.client) {
      return;
    }
    hydrated.value = true;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        items.value = JSON.parse(stored) as ProductSummaryDto[];
      }
    } catch {
      items.value = [];
    }
  };

  return {
    items,
    count,
    isFull,
    canCompare,
    compareLink,
    has,
    toggle,
    remove,
    clear,
    hydrate,
    maxItems,
  };
});
