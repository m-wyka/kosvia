<script setup lang="ts">
import type { CategoryDto, ProductSearchResult, ProductSort } from '@kosvia/shared';

const DEFAULT_PAGE_SIZE = '24';
const DEFAULT_SORT: ProductSort = 'recommended';
const SORT_VALUES: ProductSort[] = [
  'recommended',
  'best-match',
  'price-asc',
  'price-desc',
  'ingredient-score',
  'newest',
];

const route = useRoute();
const router = useRouter();
const { refresh: refreshShelf, favoriteIds, toggleFavorite } = useShelf();
const { t } = useI18n();
const vocab = useVocabulary();

const filtersOpen = ref(false);

const queryString = computed(() => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(route.query)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    params.set(key, String(value));
  }
  if (!params.has('pageSize')) {
    params.set('pageSize', DEFAULT_PAGE_SIZE);
  }
  return params.toString();
});

const { data, pending, error, refresh } = await useApiFetch<ProductSearchResult>(
  () => `/products?${queryString.value}`,
  { key: 'product-search', watch: [queryString] },
);

const { data: categories } = await useApiFetch<CategoryDto[]>('/categories', {
  key: 'categories',
});

const sortOptions = computed(() =>
  SORT_VALUES.map((value) => ({
    value,
    label: t(`SEARCH.SORT.${value.replace(/-/g, '_').toUpperCase()}`),
  })),
);

const sort = computed({
  get: () => (route.query.sort as ProductSort) ?? DEFAULT_SORT,
  set: (value: ProductSort) =>
    router.push({ query: { ...route.query, sort: value, page: undefined } }),
});

const page = computed(() => Number(route.query.page ?? 1));
const searchTerm = computed(() => (route.query.q as string) ?? '');

const findCategoryBySlug = (nodes: CategoryDto[], slug: string): CategoryDto | null => {
  for (const node of nodes) {
    if (node.slug === slug) {
      return node;
    }
    const found = node.children?.length ? findCategoryBySlug(node.children, slug) : null;
    if (found) {
      return found;
    }
  }
  return null;
};

const activeCategory = computed(() => {
  const slug = route.query.category as string | undefined;
  if (!slug) {
    return null;
  }
  return findCategoryBySlug(categories.value ?? [], slug);
});

const heading = computed(() => {
  if (searchTerm.value) {
    return t('SEARCH.RESULTS_FOR', { query: searchTerm.value });
  }
  if (activeCategory.value) {
    return vocab.category(activeCategory.value.slug, activeCategory.value.name);
  }
  return t('SEARCH.ALL_PRODUCTS');
});

const categoryDescription = computed(() =>
  activeCategory.value
    ? vocab.categoryDescription(activeCategory.value.slug, activeCategory.value.description)
    : '',
);

const goToPage = (nextPage: number) => {
  router.push({ query: { ...route.query, page: nextPage === 1 ? undefined : nextPage } });
  if (import.meta.client) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
};

onMounted(refreshShelf);

useSeo(() => ({
  title: heading.value,
  description: categoryDescription.value
    ? t('SEO.PRODUCTS.CATEGORY_DESCRIPTION', { description: categoryDescription.value })
    : t('SEO.PRODUCTS.DESCRIPTION'),
  path: activeCategory.value ? `/products?category=${activeCategory.value.slug}` : '/products',
  noindex: Boolean(searchTerm.value || page.value > 1),
}));

useBreadcrumbJsonLd(
  computed(() => [
    { name: t('NAV.HOME'), path: '/' },
    { name: t('NAV.PRODUCTS'), path: '/products' },
    ...(activeCategory.value
      ? [
          {
            name: vocab.category(activeCategory.value.slug, activeCategory.value.name),
            path: `/products?category=${activeCategory.value.slug}`,
          },
        ]
      : []),
  ]),
);
</script>

<template>
  <div class="container-page py-8 sm:py-10">
    <header class="mb-6">
      <nav aria-label="Breadcrumb" class="mb-2 flex items-center gap-1.5 text-xs text-ink-muted">
        <NuxtLinkLocale to="/" class="hover:text-ink">{{ $t('NAV.HOME') }}</NuxtLinkLocale>
        <BaseIcon name="chevron-right" :size="12" />
        <NuxtLinkLocale to="/products" class="hover:text-ink">
          {{ $t('NAV.PRODUCTS') }}
        </NuxtLinkLocale>
        <template v-if="activeCategory">
          <BaseIcon name="chevron-right" :size="12" />
          <span class="text-ink">
            {{ vocab.category(activeCategory.slug, activeCategory.name) }}
          </span>
        </template>
      </nav>

      <h1 class="font-display text-3xl text-ink sm:text-4xl">{{ heading }}</h1>
      <p v-if="categoryDescription" class="mt-2 max-w-2xl text-sm text-ink-muted">
        {{ categoryDescription }}
      </p>
    </header>

    <div class="lg:grid lg:grid-cols-[16rem_1fr] lg:gap-10">
      <aside class="hidden lg:block">
        <div class="sticky top-24">
          <ProductFilters
            :facets="data?.facets"
            :categories="categories ?? []"
            :loading="pending"
          />
        </div>
      </aside>

      <div class="min-w-0">
        <div class="mb-5 flex items-center justify-between gap-3">
          <p class="shrink-0 text-sm whitespace-nowrap text-ink-muted">
            <template v-if="pending">{{ $t('SEARCH.SEARCHING') }}</template>
            <template v-else-if="data">{{ $t('SEARCH.COUNT', data.total) }}</template>
          </p>

          <div class="flex min-w-0 items-center gap-2">
            <BaseButton variant="secondary" size="sm" class="lg:hidden" @click="filtersOpen = true">
              <template #icon><BaseIcon name="filter" :size="15" /></template>
              {{ $t('SEARCH.FILTERS') }}
            </BaseButton>

            <BaseNativeSelect
              v-model="sort"
              :options="sortOptions"
              size="sm"
              class="w-40 sm:w-48"
              :aria-label="$t('SEARCH.SORT_LABEL')"
            />
          </div>
        </div>

        <BaseErrorState v-if="error" @retry="refresh()" />

        <BaseEmptyState
          v-else-if="!pending && data && data.items.length === 0"
          icon="search"
          :title="$t('SEARCH.EMPTY_TITLE')"
          :description="$t('SEARCH.EMPTY_BODY')"
        >
          <BaseButton variant="secondary" to="/products">{{ $t('SEARCH.EMPTY_CTA') }}</BaseButton>
        </BaseEmptyState>

        <template v-else>
          <ProductGrid
            :products="data?.items"
            :loading="pending"
            :favorite-ids="favoriteIds"
            :columns="3"
            show-compare
            @favorite="toggleFavorite"
          />

          <nav
            v-if="data && data.pageCount > 1"
            class="mt-10 flex items-center justify-center gap-2"
            :aria-label="$t('SEARCH.PAGE', { page, total: data.pageCount })"
          >
            <BaseButton
              variant="secondary"
              size="sm"
              :disabled="page <= 1"
              @click="goToPage(page - 1)"
            >
              {{ $t('COMMON.PREVIOUS') }}
            </BaseButton>
            <span class="px-3 text-sm tabular-nums text-ink-muted">
              {{ $t('SEARCH.PAGE', { page, total: data.pageCount }) }}
            </span>
            <BaseButton
              variant="secondary"
              size="sm"
              :disabled="page >= data.pageCount"
              @click="goToPage(page + 1)"
            >
              {{ $t('COMMON.NEXT') }}
            </BaseButton>
          </nav>
        </template>
      </div>
    </div>

    <BaseModal v-model:open="filtersOpen" :title="$t('SEARCH.FILTERS')" size="sm">
      <ProductFilters :facets="data?.facets" :categories="categories ?? []" />
      <template #footer>
        <BaseButton block @click="filtersOpen = false">
          {{ $t('SEARCH.SHOW_COUNT', { count: data?.total ?? 0 }) }}
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
