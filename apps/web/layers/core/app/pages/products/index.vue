<script setup lang="ts">
import type { CategoryDto, ProductSearchResult, ProductSort } from '@kosvia/shared';

/**
 * Catalogue search.
 *
 * All state lives in the URL: `/products?category=moisturizers&maxPrice=70`
 * is a real, linkable, indexable page rather than a client-side view.
 */
const route = useRoute();
const router = useRouter();
const shelf = useShelf();

const queryString = computed(() => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(route.query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  if (!params.has('pageSize')) params.set('pageSize', '24');
  return params.toString();
});

const { data, pending, error, refresh } = await useApiFetch<ProductSearchResult>(
  () => `/products?${queryString.value}`,
  { key: 'product-search', watch: [queryString] },
);

const { data: categories } = await useApiFetch<CategoryDto[]>('/categories', { key: 'categories' });

const SORTS: Array<{ value: ProductSort; label: string }> = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'best-match', label: 'Best match for me' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'ingredient-score', label: 'Best ingredients' },
  { value: 'newest', label: 'Newest' },
];

const sort = computed({
  get: () => (route.query.sort as ProductSort) ?? 'recommended',
  set: (value: ProductSort) => router.push({ query: { ...route.query, sort: value, page: undefined } }),
});

const page = computed(() => Number(route.query.page ?? 1));
function goToPage(next: number) {
  router.push({ query: { ...route.query, page: next === 1 ? undefined : next } });
  if (import.meta.client) window.scrollTo({ top: 0, behavior: 'smooth' });
}

const filtersOpen = ref(false);
const searchTerm = computed(() => (route.query.q as string) ?? '');

const activeCategory = computed(() => {
  const slug = route.query.category as string | undefined;
  if (!slug) return null;
  const find = (nodes: CategoryDto[]): CategoryDto | null => {
    for (const node of nodes) {
      if (node.slug === slug) return node;
      const found = node.children?.length ? find(node.children) : null;
      if (found) return found;
    }
    return null;
  };
  return find(categories.value ?? []);
});

const heading = computed(() => {
  if (searchTerm.value) return `Results for “${searchTerm.value}”`;
  if (activeCategory.value) return activeCategory.value.name;
  return 'All products';
});

onMounted(() => shelf.refresh());

useSeo(() => ({
  title: heading.value,
  description: activeCategory.value?.description
    ? `${activeCategory.value.description} Compare ingredients, personal match and prices across stores on Kosvia.`
    : 'Search cosmetics by ingredient, brand, price and skin type. Every product scored against your profile.',
  // Filtered permutations point their canonical at the clean category page, so
  // the index is not flooded with near-duplicates.
  path: activeCategory.value ? `/products?category=${activeCategory.value.slug}` : '/products',
  noindex: Boolean(searchTerm.value || page.value > 1),
}));

useBreadcrumbJsonLd(
  computed(() => [
    { name: 'Home', path: '/' },
    { name: 'Products', path: '/products' },
    ...(activeCategory.value
      ? [{ name: activeCategory.value.name, path: `/products?category=${activeCategory.value.slug}` }]
      : []),
  ]),
);
</script>

<template>
  <div class="container-page py-8 sm:py-10">
    <header class="mb-6">
      <nav aria-label="Breadcrumb" class="mb-2 flex items-center gap-1.5 text-xs text-ink-muted">
        <NuxtLink to="/" class="hover:text-ink">Home</NuxtLink>
        <BaseIcon name="chevron-right" :size="12" />
        <NuxtLink to="/products" class="hover:text-ink">Products</NuxtLink>
        <template v-if="activeCategory">
          <BaseIcon name="chevron-right" :size="12" />
          <span class="text-ink">{{ activeCategory.name }}</span>
        </template>
      </nav>

      <h1 class="font-display text-3xl text-ink sm:text-4xl">{{ heading }}</h1>
      <p v-if="activeCategory?.description" class="mt-2 max-w-2xl text-sm text-ink-muted">
        {{ activeCategory.description }}
      </p>
    </header>

    <div class="lg:grid lg:grid-cols-[16rem_1fr] lg:gap-10">
      <!-- Desktop filter rail -->
      <aside class="hidden lg:block">
        <div class="sticky top-24">
          <ProductFilters :facets="data?.facets" :categories="categories ?? []" :loading="pending" />
        </div>
      </aside>

      <div class="min-w-0">
        <div class="mb-5 flex items-center justify-between gap-3">
          <p class="shrink-0 text-sm whitespace-nowrap text-ink-muted">
            <template v-if="pending">Searching…</template>
            <template v-else-if="data">
              {{ data.total }} product{{ data.total === 1 ? '' : 's' }}
            </template>
          </p>

          <div class="flex min-w-0 items-center gap-2">
            <BaseButton variant="secondary" size="sm" class="lg:hidden" @click="filtersOpen = true">
              <template #icon><BaseIcon name="filter" :size="15" /></template>
              Filters
            </BaseButton>

            <BaseNativeSelect
              v-model="sort"
              :options="SORTS"
              size="sm"
              class="w-40 sm:w-48"
              aria-label="Sort products"
            />
          </div>
        </div>

        <BaseErrorState v-if="error" @retry="refresh()" />

        <BaseEmptyState
          v-else-if="!pending && data && data.items.length === 0"
          icon="search"
          title="Nothing matched those filters"
          description="Try widening the price range, or clearing a filter or two."
        >
          <BaseButton variant="secondary" to="/products">Clear all filters</BaseButton>
        </BaseEmptyState>

        <template v-else>
          <ProductGrid
            :products="data?.items"
            :loading="pending"
            :favorite-ids="shelf.favoriteIds.value"
            :columns="3"
            show-compare
            @favorite="shelf.toggleFavorite"
          />

          <nav
            v-if="data && data.pageCount > 1"
            class="mt-10 flex items-center justify-center gap-2"
            aria-label="Pagination"
          >
            <BaseButton
              variant="secondary"
              size="sm"
              :disabled="page <= 1"
              @click="goToPage(page - 1)"
            >Previous</BaseButton>
            <span class="px-3 text-sm tabular-nums text-ink-muted">
              Page {{ page }} of {{ data.pageCount }}
            </span>
            <BaseButton
              variant="secondary"
              size="sm"
              :disabled="page >= data.pageCount"
              @click="goToPage(page + 1)"
            >Next</BaseButton>
          </nav>
        </template>
      </div>
    </div>

    <!-- Mobile filter sheet -->
    <BaseModal v-model:open="filtersOpen" title="Filters" size="sm">
      <ProductFilters :facets="data?.facets" :categories="categories ?? []" />
      <template #footer>
        <BaseButton block @click="filtersOpen = false">
          Show {{ data?.total ?? 0 }} products
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
