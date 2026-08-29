<script setup lang="ts">
import type { CategoryDto, ProductFacetsDto } from '@kosvia/shared';

type QueryPatch = Record<string, string | number | boolean | undefined>;

const DEFAULT_PRICE_CEILING = 250;
const PRICE_CEILING_STEP = 10;
const FILTER_KEYS = [
  'category',
  'brand',
  'maxPrice',
  'minPrice',
  'skinType',
  'fragranceFree',
  'vegan',
  'crueltyFree',
];

const props = defineProps<{
  facets?: ProductFacetsDto | null;
  categories: CategoryDto[];
  loading?: boolean;
}>();

const route = useRoute();
const router = useRouter();
const vocab = useVocabulary();

const maxPrice = ref(Number(route.query.maxPrice ?? 0) || 0);

const query = computed(() => route.query);

const activeBrands = computed(() =>
  String(route.query.brand ?? '')
    .split(',')
    .filter(Boolean),
);

const flatCategories = computed(() => {
  const output: Array<{ slug: string; name: string; depth: number }> = [];
  const collect = (nodes: CategoryDto[], depth: number) => {
    for (const node of nodes) {
      output.push({ slug: node.slug, name: vocab.category(node.slug, node.name), depth });
      if (node.children?.length) {
        collect(node.children, depth + 1);
      }
    }
  };
  collect(props.categories, 0);
  return output;
});

const priceCeiling = computed(
  () =>
    Math.ceil((props.facets?.priceRange.max ?? DEFAULT_PRICE_CEILING) / PRICE_CEILING_STEP) *
    PRICE_CEILING_STEP,
);

const activeCount = computed(() => FILTER_KEYS.filter((key) => route.query[key]).length);

const isEmptyValue = (value: unknown): boolean =>
  value === undefined || value === '' || value === false || value === null;

const update = (patch: QueryPatch) => {
  const nextQuery: Record<string, string> = {};
  for (const [key, value] of Object.entries({ ...route.query, ...patch })) {
    if (isEmptyValue(value)) {
      continue;
    }
    nextQuery[key] = String(value);
  }
  delete nextQuery.page;
  router.push({ path: route.path, query: nextQuery });
};

const toggleBrand = (slug: string) => {
  const current = activeBrands.value;
  const nextBrands = current.includes(slug)
    ? current.filter((entry) => entry !== slug)
    : [...current, slug];
  update({ brand: nextBrands.join(',') || undefined });
};

const clearAll = () => {
  const preserved: Record<string, string> = {};
  if (route.query.q) {
    preserved.q = String(route.query.q);
  }
  if (route.query.sort) {
    preserved.sort = String(route.query.sort);
  }
  router.push({ path: route.path, query: preserved });
};

watch(
  () => route.query.maxPrice,
  (value) => {
    maxPrice.value = Number(value ?? 0) || 0;
  },
);
</script>

<template>
  <div class="space-y-7">
    <div v-if="activeCount" class="flex items-center justify-between gap-2">
      <p class="text-sm text-ink-muted">{{ $t('SEARCH.FILTER.APPLIED', activeCount) }}</p>
      <button
        type="button"
        class="text-sm font-medium text-ink underline-offset-4 hover:underline"
        @click="clearAll"
      >
        {{ $t('COMMON.CLEAR_ALL') }}
      </button>
    </div>

    <section>
      <h3 class="mb-2.5 text-sm font-semibold text-ink">{{ $t('SEARCH.FILTER.CATEGORY') }}</h3>
      <ul class="space-y-0.5">
        <li>
          <button
            type="button"
            class="w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors"
            :class="
              !query.category
                ? 'bg-surface-muted font-medium text-ink'
                : 'text-ink-muted hover:text-ink'
            "
            @click="update({ category: undefined })"
          >
            {{ $t('SEARCH.FILTER.ALL_PRODUCTS') }}
          </button>
        </li>
        <li v-for="category in flatCategories" :key="category.slug">
          <button
            type="button"
            class="w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors"
            :class="[
              query.category === category.slug
                ? 'bg-surface-muted font-medium text-ink'
                : 'text-ink-muted hover:text-ink',
              category.depth === 1 && 'pl-5',
              category.depth >= 2 && 'pl-8',
            ]"
            @click="update({ category: category.slug })"
          >
            {{ category.name }}
          </button>
        </li>
      </ul>
    </section>

    <section>
      <BaseSlider
        v-model="maxPrice"
        :label="$t('SEARCH.FILTER.MAX_PRICE')"
        :min="0"
        :max="priceCeiling"
        :step="5"
        :format="
          (value) =>
            value === 0
              ? $t('SEARCH.FILTER.ANY_PRICE')
              : $t('SEARCH.FILTER.UP_TO', { price: value })
        "
        @change="update({ maxPrice: maxPrice || undefined })"
      />
    </section>

    <section>
      <h3 class="mb-2.5 text-sm font-semibold text-ink">{{ $t('SEARCH.FILTER.FORMULA') }}</h3>
      <div class="space-y-2.5">
        <BaseCheckbox
          :model-value="query.fragranceFree === 'true'"
          :label="$t('SEARCH.FILTER.FRAGRANCE_FREE')"
          @update:model-value="update({ fragranceFree: $event || undefined })"
        />
        <BaseCheckbox
          :model-value="query.vegan === 'true'"
          :label="$t('SEARCH.FILTER.VEGAN')"
          @update:model-value="update({ vegan: $event || undefined })"
        />
        <BaseCheckbox
          :model-value="query.crueltyFree === 'true'"
          :label="$t('SEARCH.FILTER.CRUELTY_FREE')"
          @update:model-value="update({ crueltyFree: $event || undefined })"
        />
      </div>
    </section>

    <section>
      <h3 class="mb-2.5 text-sm font-semibold text-ink">{{ $t('SEARCH.FILTER.SKIN_TYPE') }}</h3>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="type in vocab.concreteSkinTypes.value"
          :key="type"
          type="button"
          class="rounded-pill border px-3 py-1.5 text-xs font-medium transition-colors"
          :class="
            query.skinType === type
              ? 'border-ink bg-ink text-ink-inverse'
              : 'border-line text-ink-muted hover:border-line-strong hover:text-ink'
          "
          @click="update({ skinType: query.skinType === type ? undefined : type })"
        >
          {{ vocab.skinType(type) }}
        </button>
      </div>
    </section>

    <section v-if="facets?.brands.length">
      <h3 class="mb-2.5 text-sm font-semibold text-ink">{{ $t('SEARCH.FILTER.BRAND') }}</h3>
      <ul class="hide-scrollbar max-h-64 space-y-1.5 overflow-y-auto pr-1">
        <li v-for="brand in facets.brands" :key="brand.id">
          <BaseCheckbox
            :model-value="activeBrands.includes(brand.slug)"
            @update:model-value="toggleBrand(brand.slug)"
          >
            <span class="flex min-w-0 flex-1 items-baseline justify-between gap-2">
              <span class="truncate text-sm text-ink">{{ brand.name }}</span>
              <span class="shrink-0 text-xs tabular-nums text-ink-faint">{{ brand.count }}</span>
            </span>
          </BaseCheckbox>
        </li>
      </ul>
    </section>
  </div>
</template>
