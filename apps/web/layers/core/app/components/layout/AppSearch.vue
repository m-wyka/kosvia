<script setup lang="ts">
import type { DiscoveryFeedDto, ProductSummaryDto } from '@kosvia/shared';

const RESULT_LIMIT = 6;
const SKELETON_COUNT = 4;
const MAX_QUERY_LENGTH = 60;
const MIN_PREVIEW_QUERY_LENGTH = 2;
const PREVIEW_DEBOUNCE_MS = 250;
const POPULAR_QUERY_KEYS = ['RETINOL', 'NIACINAMIDE', 'SPF', 'CLEANSER', 'VITAMIN_C'] as const;

const { isAuthenticated } = storeToRefs(useAuthStore());
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const localePath = useLocalePath();

const panelId = useId();
const isOpen = ref(false);
const query = ref('');
const queryInput = ref<HTMLInputElement | null>(null);

const trimmedQuery = computed(() => query.value.trim());
const hasQuery = computed(() => trimmedQuery.value.length > 0);

const debouncedQuery = refDebounced(trimmedQuery, PREVIEW_DEBOUNCE_MS);
const isPreviewable = computed(() => debouncedQuery.value.length >= MIN_PREVIEW_QUERY_LENGTH);

const {
  data: feed,
  status: feedStatus,
  execute: loadFeed,
} = useApiFetch<DiscoveryFeedDto>('/discover', {
  key: 'search-feed',
  immediate: false,
  lazy: true,
});

const {
  data: loggedPopularQueries,
  status: popularQueriesStatus,
  execute: loadPopularQueries,
} = useApiFetch<string[]>('/products/popular-queries', {
  key: 'search-popular-queries',
  immediate: false,
  lazy: true,
});

const {
  data: previewResults,
  status: previewStatus,
  execute: loadPreview,
} = useApiFetch<ProductSummaryDto[]>(
  () => `/products/preview?q=${encodeURIComponent(debouncedQuery.value)}`,
  { key: 'search-preview', immediate: false, lazy: true, watch: false },
);

const curatedQueries = computed(() =>
  POPULAR_QUERY_KEYS.map((key) => t(`SEARCH.OVERLAY.QUERY.${key}`)),
);

const popularQueries = computed(() => {
  const logged = loggedPopularQueries.value ?? [];
  return logged.length ? logged : curatedQueries.value;
});

const recommendedProducts = computed(() => {
  const unique = new Map<string, ProductSummaryDto>();
  for (const section of feed.value?.sections ?? []) {
    for (const product of section.products) {
      if (!unique.has(product.id)) {
        unique.set(product.id, product);
      }
    }
  }
  return [...unique.values()].slice(0, RESULT_LIMIT);
});

const previewProducts = computed(() => (isPreviewable.value ? (previewResults.value ?? []) : []));

const isLoadingFeed = computed(() => feedStatus.value === 'pending');
const isLoadingPreview = computed(
  () => previewStatus.value === 'pending' || trimmedQuery.value !== debouncedQuery.value,
);

const suggestionsHeading = computed(() =>
  isAuthenticated.value ? t('SEARCH.OVERLAY.FOR_YOU') : t('SEARCH.OVERLAY.RECOMMENDED'),
);

const lockPageScroll = (locked: boolean) => {
  if (import.meta.client) {
    document.documentElement.style.overflow = locked ? 'hidden' : '';
  }
};

const closeSearch = () => {
  isOpen.value = false;
};

const openSearch = async () => {
  isOpen.value = true;
  if (feedStatus.value === 'idle') {
    loadFeed();
  }
  if (popularQueriesStatus.value === 'idle') {
    loadPopularQueries();
  }
  await nextTick();
  queryInput.value?.focus();
};

const applyPopularQuery = (popular: string) => {
  query.value = popular;
  queryInput.value?.focus();
};

const submitSearch = () => {
  if (!hasQuery.value) {
    return;
  }
  closeSearch();
  router.push({ path: localePath('/products'), query: { q: trimmedQuery.value } });
};

onKeyStroke('Escape', () => {
  if (isOpen.value) {
    closeSearch();
  }
});

watch(debouncedQuery, () => {
  if (isPreviewable.value) {
    loadPreview();
  }
});

watchEffect(() => lockPageScroll(isOpen.value));
onUnmounted(() => lockPageScroll(false));

watch(
  () => route.fullPath,
  () => {
    closeSearch();
  },
);
</script>

<template>
  <div>
    <button
      type="button"
      class="rounded-md p-2 text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
      :aria-expanded="isOpen"
      :aria-controls="panelId"
      :aria-label="$t('NAV.SEARCH_LABEL')"
      @click="openSearch"
    >
      <BaseIcon name="search" :size="20" />
    </button>

    <ClientOnly>
      <Teleport to="body">
        <Transition
          enter-active-class="transition-all duration-slow ease-out-soft"
          leave-active-class="transition-all duration-base ease-out-soft"
          enter-from-class="opacity-0 backdrop-blur-[0px]"
          leave-to-class="opacity-0 backdrop-blur-[0px]"
        >
          <div
            v-if="isOpen"
            class="fixed inset-0 z-40 bg-overlay backdrop-blur-md"
            @click="closeSearch"
          />
        </Transition>

        <Transition
          enter-active-class="transition-all duration-base ease-out-soft"
          leave-active-class="transition-all duration-fast ease-out-soft"
          enter-from-class="translate-y-2 opacity-0"
          leave-to-class="translate-y-2 opacity-0"
        >
          <div v-if="isOpen" class="fixed inset-0 z-50 overflow-y-auto" @click.self="closeSearch">
            <div
              class="mx-auto w-full max-w-3xl px-5 pt-4 pb-10 md:px-8 md:pt-20"
              @click.self="closeSearch"
            >
              <div
                :id="panelId"
                class="overflow-hidden rounded-2xl border border-line bg-surface/95 shadow-lg backdrop-blur-xl"
                role="dialog"
                aria-modal="true"
                :aria-label="$t('NAV.SEARCH_LABEL')"
              >
                <form
                  class="flex items-center gap-3 border-b border-line px-4"
                  role="search"
                  @submit.prevent="submitSearch"
                >
                  <BaseIcon name="search" :size="18" class="shrink-0 text-ink-faint" />
                  <input
                    ref="queryInput"
                    v-model="query"
                    type="search"
                    :maxlength="MAX_QUERY_LENGTH"
                    :placeholder="$t('NAV.SEARCH_PLACEHOLDER')"
                    class="h-14 min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-ink-faint focus:outline-none"
                    :aria-label="$t('NAV.SEARCH_LABEL')"
                  />
                  <button
                    type="button"
                    class="-mr-1.5 shrink-0 rounded-md p-1.5 text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
                    :aria-label="$t('COMMON.CLOSE')"
                    @click="closeSearch"
                  >
                    <BaseIcon name="close" :size="18" />
                  </button>
                </form>

                <div class="max-h-[min(70vh,32rem)] overflow-y-auto bg-canvas/75 p-4">
                  <template v-if="!hasQuery">
                    <section>
                      <h2 class="px-1 text-2xs font-medium tracking-wide text-ink-muted uppercase">
                        {{ $t('SEARCH.OVERLAY.POPULAR') }}
                      </h2>
                      <ul class="mt-2 flex flex-wrap gap-1.5">
                        <li v-for="popular in popularQueries" :key="popular">
                          <button
                            type="button"
                            class="rounded-pill border border-line bg-surface px-3 py-1.5 text-sm text-ink-soft shadow-xs transition-colors hover:border-line-strong hover:text-ink"
                            @click="applyPopularQuery(popular)"
                          >
                            {{ popular }}
                          </button>
                        </li>
                      </ul>
                    </section>

                    <section class="mt-5">
                      <h2 class="px-1 text-2xs font-medium tracking-wide text-ink-muted uppercase">
                        {{ suggestionsHeading }}
                      </h2>
                      <div v-if="isLoadingFeed" class="mt-2 grid gap-2 sm:grid-cols-2">
                        <div
                          v-for="placeholder in SKELETON_COUNT"
                          :key="placeholder"
                          class="skeleton h-19 rounded-xl"
                        />
                      </div>
                      <div v-else class="mt-2 grid gap-2 sm:grid-cols-2">
                        <ProductSearchTile
                          v-for="product in recommendedProducts"
                          :key="product.id"
                          :product="product"
                        />
                      </div>
                    </section>
                  </template>

                  <template v-else>
                    <div v-if="isLoadingPreview" class="grid gap-2 sm:grid-cols-2">
                      <div
                        v-for="placeholder in SKELETON_COUNT"
                        :key="placeholder"
                        class="skeleton h-19 rounded-xl"
                      />
                    </div>
                    <div v-else-if="previewProducts.length" class="grid gap-2 sm:grid-cols-2">
                      <ProductSearchTile
                        v-for="product in previewProducts"
                        :key="product.id"
                        :product="product"
                      />
                    </div>
                    <p v-else class="px-1 py-8 text-center text-sm text-ink-muted">
                      {{ $t('SEARCH.OVERLAY.EMPTY', { query: trimmedQuery }) }}
                    </p>
                  </template>
                </div>

                <footer v-if="hasQuery" class="border-t border-line bg-surface p-2">
                  <button
                    type="button"
                    class="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
                    @click="submitSearch"
                  >
                    {{ $t('SEARCH.OVERLAY.SEE_ALL', { query: trimmedQuery }) }}
                    <BaseIcon name="arrow-right" :size="16" class="shrink-0" />
                  </button>
                </footer>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>
    </ClientOnly>
  </div>
</template>
