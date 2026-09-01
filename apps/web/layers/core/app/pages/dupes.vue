<script setup lang="ts">
import type { DupeResultDto, ProductSummaryDto } from '@kosvia/shared';

const MIN_SEARCH_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 280;
const SEARCH_PAGE_SIZE = 8;

const api = useApi();
const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const format = useFormat();

const search = ref('');
const searching = ref(false);
const results = ref<ProductSummaryDto[]>([]);

const subjectSlug = computed(() => String(route.query.product ?? ''));

const { data, pending, error, refresh } = await useApiFetch<DupeResultDto>(
  () => `/products/${subjectSlug.value}/dupes`,
  {
    key: 'dupes',
    watch: [subjectSlug],
    immediate: subjectSlug.value.length > 0,
  },
);

const searchProducts = async (term: string) => {
  if (term.trim().length < MIN_SEARCH_LENGTH) {
    results.value = [];
    return;
  }
  searching.value = true;
  try {
    const response = await api<{ items: ProductSummaryDto[] }>(
      `/products?q=${encodeURIComponent(term)}&pageSize=${SEARCH_PAGE_SIZE}`,
    );
    results.value = response.items;
  } finally {
    searching.value = false;
  }
};

const pickSubject = (product: ProductSummaryDto) => {
  search.value = '';
  results.value = [];
  router.push({ query: { product: product.slug } });
};

const priceDifferenceLabel = (difference: number | null): string | null => {
  if (difference === null || difference === 0) {
    return null;
  }
  const amount = format.price(Math.abs(difference));
  return difference < 0 ? t('DUPES.CHEAPER_BY', { amount }) : t('DUPES.PRICIER_BY', { amount });
};

watchDebounced(search, searchProducts, { debounce: SEARCH_DEBOUNCE_MS });

useSeo(() => ({
  title: t('SEO.DUPES.TITLE'),
  description: t('SEO.DUPES.DESCRIPTION'),
  path: '/dupes',
}));
</script>

<template>
  <div class="container-page py-8 sm:py-12">
    <header class="mb-8 max-w-2xl">
      <h1 class="font-display text-3xl text-ink sm:text-4xl">
        {{ $t('DUPES.TITLE') }}
      </h1>
      <p class="mt-2 text-sm leading-relaxed text-ink-muted">
        {{ $t('DUPES.SUBTITLE') }}
      </p>
    </header>

    <div class="max-w-xl">
      <BaseInput
        v-model="search"
        :label="$t('DUPES.SEARCH_LABEL')"
        :placeholder="$t('DUPES.SEARCH_PLACEHOLDER')"
      >
        <template #suffix>
          <BaseSpinner v-if="searching" :size="14" />
        </template>
      </BaseInput>

      <ul
        v-if="results.length"
        class="mt-2 divide-y divide-line rounded-xl border border-line bg-surface"
      >
        <li v-for="product in results" :key="product.id">
          <button
            type="button"
            class="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-surface-muted"
            @click="pickSubject(product)"
          >
            <ProductImage
              :src="product.imageUrl"
              :alt="product.name"
              ratio="square"
              class="w-10 shrink-0 rounded-md"
            />
            <span class="min-w-0">
              <span class="block truncate text-2xs tracking-wide text-ink-muted uppercase">
                {{ product.brand.name }}
              </span>
              <span class="block truncate text-sm font-medium text-ink">
                {{ product.name }}
              </span>
            </span>
          </button>
        </li>
      </ul>
    </div>

    <BaseEmptyState
      v-if="!subjectSlug"
      icon="sparkles"
      :title="$t('DUPES.PICK_TITLE')"
      :description="$t('DUPES.PICK_BODY')"
      class="mt-10"
    />

    <template v-else>
      <BaseErrorState v-if="error" class="mt-10" @retry="refresh()" />

      <div v-else-if="pending" class="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ProductCardSkeleton v-for="index in 4" :key="index" />
      </div>

      <template v-else-if="data">
        <section class="mt-10">
          <h2 class="text-sm font-semibold tracking-wide text-ink-muted uppercase">
            {{ $t('DUPES.SUBJECT_LABEL') }}
          </h2>
          <div class="mt-3 max-w-64">
            <ProductCard :product="data.subject" :show-favorite="false" :show-compare="false" />
          </div>
        </section>

        <section class="mt-10">
          <h2 class="font-display text-2xl text-ink">
            {{ $t('DUPES.RESULTS_TITLE', { name: data.subject.name }) }}
          </h2>

          <BaseEmptyState
            v-if="!data.dupes.length"
            icon="sparkles"
            :title="$t('DUPES.EMPTY_TITLE')"
            :description="$t('DUPES.EMPTY_BODY')"
            class="mt-6"
          />

          <ul v-else class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <li v-for="match in data.dupes" :key="match.product.id" class="flex flex-col gap-2">
              <ProductCard :product="match.product" :show-favorite="false" class="flex-1" />
              <div class="flex flex-wrap items-center gap-1.5 px-1">
                <BaseBadge tone="lavender" size="xs">
                  {{ $t('DUPES.SIMILARITY', { percent: match.similarityPercent }) }}
                </BaseBadge>
                <BaseBadge
                  v-if="priceDifferenceLabel(match.priceDifference)"
                  :tone="match.priceDifference! < 0 ? 'positive' : 'neutral'"
                  size="xs"
                >
                  {{ priceDifferenceLabel(match.priceDifference) }}
                </BaseBadge>
                <span class="text-xs text-ink-faint">
                  {{
                    $t(
                      'DUPES.SHARED_COUNT',
                      { count: match.sharedIngredientCount },
                      match.sharedIngredientCount,
                    )
                  }}
                </span>
              </div>
            </li>
          </ul>
        </section>
      </template>
    </template>
  </div>
</template>
