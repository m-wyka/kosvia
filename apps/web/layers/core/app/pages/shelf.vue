<script setup lang="ts">
import type { ProductSummaryDto, RoutineAnalysisDto, ShelfItemDto } from '@kosvia/shared';

definePageMeta({ middleware: 'auth' });

const api = useApi();
const toast = useToast();
const message = useApiMessage();
const route = useRoute();
const { t } = useI18n();
const vocab = useVocabulary();

const { data: items, pending, error, refresh } = await useApiFetch<ShelfItemDto[]>('/shelf', {
  key: 'shelf',
  default: () => [],
});
const { data: analysis, refresh: refreshAnalysis } = await useApiFetch<RoutineAnalysisDto>(
  '/shelf/analysis',
  { key: 'shelf-analysis', lazy: true },
);

const tab = ref(String(route.query.tab ?? 'all'));
const tabs = computed(() => [
  { value: 'all', label: t('SHELF.TAB_ALL'), count: items.value?.length ?? 0 },
  {
    value: 'favorites',
    label: t('SHELF.TAB_FAVORITES'),
    count: items.value?.filter((i) => i.isFavorite).length ?? 0,
  },
  { value: 'routine', label: t('SHELF.TAB_ROUTINE') },
]);

const visible = computed(() =>
  tab.value === 'favorites' ? (items.value ?? []).filter((item) => item.isFavorite) : (items.value ?? []),
);

/** Grouped by category so the shelf reads like a routine, not a list. */
const grouped = computed(() => {
  const map = new Map<string, { name: string; slug: string; items: ShelfItemDto[] }>();
  for (const item of visible.value) {
    const key = item.product.category.id;
    if (!map.has(key)) {
      map.set(key, {
        name: item.product.category.name,
        slug: item.product.category.slug,
        items: [],
      });
    }
    map.get(key)!.items.push(item);
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
});

async function reloadAll() {
  await Promise.all([refresh(), refreshAnalysis()]);
}

async function toggleFavorite(item: ShelfItemDto) {
  try {
    await api(`/shelf/${item.id}`, { method: 'PATCH', body: { isFavorite: !item.isFavorite } });
    await refresh();
  } catch (caught) {
    toast.error(message(caught));
  }
}

async function removeItem(item: ShelfItemDto) {
  try {
    await api(`/shelf/${item.id}`, { method: 'DELETE' });
    await reloadAll();
    toast.notify(t('SHELF.REMOVED', { name: item.product.name }));
  } catch (caught) {
    toast.error(message(caught));
  }
}

/* ------------------------------------------------------------ add product -- */

const addOpen = ref(false);
const search = ref('');
const searching = ref(false);
const results = ref<ProductSummaryDto[]>([]);

watchDebounced(
  search,
  async (term) => {
    if (term.trim().length < 2) {
      results.value = [];
      return;
    }
    searching.value = true;
    try {
      const response = await api<{ items: ProductSummaryDto[] }>(
        `/products?q=${encodeURIComponent(term)}&pageSize=8`,
      );
      results.value = response.items;
    } finally {
      searching.value = false;
    }
  },
  { debounce: 280 },
);

async function addProduct(product: ProductSummaryDto) {
  try {
    await api('/shelf', { method: 'POST', body: { productId: product.id } });
    await reloadAll();
    addOpen.value = false;
    search.value = '';
    toast.success(t('SHELF.ADDED', { name: product.name }));
  } catch (caught) {
    toast.error(message(caught));
  }
}

useSeo(() => ({
  title: t('SEO.SHELF.TITLE'),
  description: t('SEO.SHELF.DESCRIPTION'),
  noindex: true,
}));
</script>

<template>
  <div class="container-page py-8 sm:py-12">
    <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="font-display text-3xl text-ink sm:text-4xl">{{ $t('SHELF.TITLE') }}</h1>
        <p class="mt-2 text-sm text-ink-muted">{{ $t('SHELF.SUBTITLE') }}</p>
      </div>
      <BaseButton @click="addOpen = true">
        <template #icon><BaseIcon name="plus" :size="17" /></template>
        {{ $t('SHELF.ADD_PRODUCT') }}
      </BaseButton>
    </header>

    <BaseTabs v-model="tab" :tabs="tabs" class="mb-7 max-w-md" />

    <BaseErrorState v-if="error" @retry="reloadAll()" />

    <div v-else-if="pending" class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <ProductCardSkeleton v-for="index in 4" :key="index" />
    </div>

    <!-- Routine analysis -->
    <div v-else-if="tab === 'routine'">
      <BaseEmptyState
        v-if="!analysis || analysis.itemCount === 0"
        icon="shelf"
        :title="$t('SHELF.ROUTINE.EMPTY_TITLE')"
        :description="$t('SHELF.ROUTINE.EMPTY_BODY')"
      >
        <BaseButton @click="addOpen = true">{{ $t('SHELF.ADD_PRODUCT') }}</BaseButton>
      </BaseEmptyState>

      <div v-else class="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <ul class="space-y-3">
          <li
            v-for="observation in analysis.observations"
            :key="observation.title"
            class="flex items-start gap-3 rounded-xl border bg-surface p-4"
            :class="observation.severity === 'notice' ? 'border-caution/30' : 'border-line'"
          >
            <span
              class="flex size-9 shrink-0 items-center justify-center rounded-lg"
              :class="observation.severity === 'notice' ? 'bg-caution-soft text-caution' : 'bg-surface-muted text-ink-faint'"
            >
              <BaseIcon :name="observation.severity === 'notice' ? 'alert' : 'info'" :size="17" />
            </span>
            <div class="min-w-0">
              <p class="text-sm font-medium text-ink">{{ observation.title }}</p>
              <p class="mt-1 text-sm leading-relaxed text-ink-muted">{{ observation.detail }}</p>
            </div>
          </li>
        </ul>

        <aside class="space-y-4">
          <BaseCard>
            <h2 class="text-sm font-semibold text-ink">{{ $t('SHELF.ROUTINE.COVERS') }}</h2>
            <ul class="mt-3 flex flex-wrap gap-1.5">
              <li v-for="category in analysis.coveredCategories" :key="category">
                <BaseBadge tone="sage" size="xs">{{ category }}</BaseBadge>
              </li>
            </ul>
          </BaseCard>

          <BaseCard v-if="analysis.missingCategories.length">
            <h2 class="text-sm font-semibold text-ink">{{ $t('SHELF.ROUTINE.GAPS') }}</h2>
            <ul class="mt-3 space-y-3">
              <li v-for="gap in analysis.missingCategories" :key="gap.slug">
                <NuxtLinkLocale
                  :to="`/products?category=${gap.slug}`"
                  class="group flex items-start justify-between gap-2"
                >
                  <span class="min-w-0">
                    <span class="block text-sm font-medium text-ink group-hover:underline">
                      {{ vocab.category(gap.slug, gap.name) }}
                    </span>
                    <span class="block text-xs text-ink-muted">{{ gap.why }}</span>
                  </span>
                  <BaseIcon name="chevron-right" :size="15" class="mt-0.5 shrink-0 text-ink-faint" />
                </NuxtLinkLocale>
              </li>
            </ul>
          </BaseCard>

          <p class="px-1 text-xs leading-relaxed text-ink-muted">
            {{ $t('SHELF.ROUTINE.NOTE') }}
          </p>
        </aside>
      </div>
    </div>

    <!-- Product lists -->
    <BaseEmptyState
      v-else-if="!visible.length"
      icon="shelf"
      :title="tab === 'favorites' ? $t('SHELF.EMPTY_FAVORITES_TITLE') : $t('SHELF.EMPTY_TITLE')"
      :description="
        tab === 'favorites' ? $t('SHELF.EMPTY_FAVORITES_BODY') : $t('SHELF.EMPTY_BODY')
      "
    >
      <BaseButton @click="addOpen = true">{{ $t('SHELF.EMPTY_CTA') }}</BaseButton>
      <BaseButton variant="secondary" to="/discover">{{ $t('SHELF.BROWSE_CTA') }}</BaseButton>
    </BaseEmptyState>

    <div v-else class="space-y-10">
      <section v-for="group in grouped" :key="group.name">
        <h2 class="mb-3 text-sm font-semibold tracking-wide text-ink-muted uppercase">
          {{ vocab.category(group.slug, group.name) }}
        </h2>
        <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <li
            v-for="item in group.items"
            :key="item.id"
            class="flex gap-3.5 rounded-xl border border-line bg-surface p-3.5"
          >
            <NuxtLinkLocale :to="`/products/${item.product.slug}`" class="w-20 shrink-0">
              <ProductImage
                :src="item.product.imageUrl"
                :alt="item.product.name"
                ratio="square"
                class="rounded-md"
              />
            </NuxtLinkLocale>

            <div class="flex min-w-0 flex-1 flex-col">
              <p class="truncate text-2xs tracking-wide text-ink-muted uppercase">
                {{ item.product.brand.name }}
              </p>
              <NuxtLinkLocale
                :to="`/products/${item.product.slug}`"
                class="text-sm leading-snug font-medium text-ink hover:underline"
              >{{ item.product.name }}</NuxtLinkLocale>

              <p v-if="item.notes" class="mt-1 line-clamp-2 text-xs text-ink-muted">{{ item.notes }}</p>

              <div class="mt-auto flex items-center justify-between gap-2 pt-2">
                <span
                  v-if="item.product.personalMatch"
                  class="text-xs font-medium tabular-nums text-ink-muted"
                >{{ $t('PRODUCT.MATCH', { score: item.product.personalMatch.score }) }}</span>
                <span class="flex items-center gap-0.5">
                  <button
                    type="button"
                    class="rounded-md p-1.5 transition-colors"
                    :class="item.isFavorite ? 'text-blush-deep' : 'text-ink-faint hover:text-ink'"
                    :aria-label="item.isFavorite ? $t('SHELF.REMOVE_FAVORITE') : $t('SHELF.ADD_FAVORITE')"
                    :aria-pressed="item.isFavorite"
                    @click="toggleFavorite(item)"
                  >
                    <BaseIcon :name="item.isFavorite ? 'heart-filled' : 'heart'" :size="16" />
                  </button>
                  <button
                    type="button"
                    class="rounded-md p-1.5 text-ink-faint transition-colors hover:text-critical"
                    :aria-label="$t('SHELF.REMOVE_ITEM', { name: item.product.name })"
                    @click="removeItem(item)"
                  >
                    <BaseIcon name="trash" :size="16" />
                  </button>
                </span>
              </div>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <BaseModal
      v-model:open="addOpen"
      :title="$t('SHELF.ADD_MODAL.TITLE')"
      :description="$t('SHELF.ADD_MODAL.BODY')"
      size="md"
    >
      <BaseInput
        v-model="search"
        :placeholder="$t('SHELF.ADD_MODAL.PLACEHOLDER')"
        autocomplete="off"
      >
        <template #prefix><BaseIcon name="search" :size="16" /></template>
      </BaseInput>

      <div class="mt-4 max-h-80 space-y-2 overflow-y-auto">
        <div v-if="searching" class="space-y-2">
          <BaseSkeleton v-for="index in 3" :key="index" height="4rem" rounded="var(--radius-lg)" />
        </div>

        <p v-else-if="search.trim().length >= 2 && !results.length" class="py-6 text-center text-sm text-ink-muted">
          {{ $t('SHELF.ADD_MODAL.NO_RESULTS', { query: search }) }}
        </p>

        <button
          v-for="product in results"
          v-else
          :key="product.id"
          type="button"
          class="flex w-full items-center gap-3 rounded-lg border border-line p-2.5 text-left
                 transition-colors hover:border-line-strong hover:bg-surface-muted"
          @click="addProduct(product)"
        >
          <ProductImage :src="product.imageUrl" :alt="product.name" ratio="square" class="w-12 rounded-md" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-2xs tracking-wide text-ink-muted uppercase">
              {{ product.brand.name }}
            </span>
            <span class="block truncate text-sm font-medium text-ink">{{ product.name }}</span>
          </span>
          <BaseIcon name="plus" :size="17" class="shrink-0 text-ink-faint" />
        </button>
      </div>
    </BaseModal>
  </div>
</template>
