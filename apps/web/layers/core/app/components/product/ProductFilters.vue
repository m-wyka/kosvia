<script setup lang="ts">
import type { CategoryDto, ProductFacetsDto } from '@kosvia/shared';

/**
 * Search filters.
 *
 * Every control writes to the URL rather than to local state — that keeps
 * filtered pages linkable, shareable and indexable, and means the back button
 * behaves the way people expect.
 */
const props = defineProps<{
  facets?: ProductFacetsDto | null;
  categories: CategoryDto[];
  loading?: boolean;
}>();

const route = useRoute();
const router = useRouter();
const vocab = useVocabulary();

const query = computed(() => route.query);

function update(patch: Record<string, string | number | boolean | undefined>) {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries({ ...route.query, ...patch })) {
    if (value === undefined || value === '' || value === false || value === null) {continue;}
    next[key] = String(value);
  }
  delete next.page;
  router.push({ path: route.path, query: next });
}

function toggleBrand(slug: string) {
  const current = String(route.query.brand ?? '').split(',').filter(Boolean);
  const next = current.includes(slug)
    ? current.filter((entry) => entry !== slug)
    : [...current, slug];
  update({ brand: next.join(',') || undefined });
}

const activeBrands = computed(() => String(route.query.brand ?? '').split(',').filter(Boolean));

/** Flattened leaf categories — the tree is for navigation, this is for filtering. */
const flatCategories = computed(() => {
  const output: Array<{ slug: string; name: string; depth: number }> = [];
  const walk = (nodes: CategoryDto[], depth: number) => {
    for (const node of nodes) {
      output.push({ slug: node.slug, name: vocab.category(node.slug, node.name), depth });
      if (node.children?.length) {walk(node.children, depth + 1);}
    }
  };
  walk(props.categories, 0);
  return output;
});

const maxPrice = ref(Number(route.query.maxPrice ?? 0) || 0);
watch(() => route.query.maxPrice, (value) => { maxPrice.value = Number(value ?? 0) || 0; });

const priceCeiling = computed(() => Math.ceil((props.facets?.priceRange.max ?? 250) / 10) * 10);

const activeCount = computed(
  () =>
    ['category', 'brand', 'maxPrice', 'minPrice', 'skinType', 'fragranceFree', 'vegan', 'crueltyFree'].filter(
      (key) => route.query[key],
    ).length,
);

function clearAll() {
  const preserved: Record<string, string> = {};
  if (route.query.q) {preserved.q = String(route.query.q);}
  if (route.query.sort) {preserved.sort = String(route.query.sort);}
  router.push({ path: route.path, query: preserved });
}
</script>

<template>
  <div class="space-y-7">
    <div v-if="activeCount" class="flex items-center justify-between gap-2">
      <p class="text-sm text-ink-muted">{{ $t('SEARCH.FILTER.APPLIED', activeCount) }}</p>
      <button
        type="button"
        class="text-sm font-medium text-ink underline-offset-4 hover:underline"
        @click="clearAll"
      >{{ $t('COMMON.CLEAR_ALL') }}</button>
    </div>

    <section>
      <h3 class="mb-2.5 text-sm font-semibold text-ink">{{ $t('SEARCH.FILTER.CATEGORY') }}</h3>
      <ul class="space-y-0.5">
        <li>
          <button
            type="button"
            class="w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors"
            :class="!query.category ? 'bg-surface-muted font-medium text-ink' : 'text-ink-muted hover:text-ink'"
            @click="update({ category: undefined })"
          >{{ $t('SEARCH.FILTER.ALL_PRODUCTS') }}</button>
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
          >{{ category.name }}</button>
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
            value === 0 ? $t('SEARCH.FILTER.ANY_PRICE') : $t('SEARCH.FILTER.UP_TO', { price: value })
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
        >{{ vocab.skinType(type) }}</button>
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
