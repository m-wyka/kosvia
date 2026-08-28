<script setup lang="ts">
import { formatPrice, type ComparisonResultDto } from '@kosvia/shared';

const route = useRoute();
const router = useRouter();
const compare = useCompareStore();

onMounted(() => {
  compare.hydrate();
  // Land here from a shared link with nothing in the tray? Seed it from the URL.
  if (!route.query.products && compare.items.length >= 2) {
    router.replace({ query: { products: compare.items.map((item) => item.slug).join(',') } });
  }
});

const slugs = computed(() => String(route.query.products ?? '').split(',').filter(Boolean));

const { data, pending, error, refresh } = await useApiFetch<ComparisonResultDto>(
  () => `/compare?products=${slugs.value.join(',')}`,
  {
    key: 'comparison',
    watch: [slugs],
    immediate: slugs.value.length >= 2,
  },
);

function removeProduct(slug: string) {
  const next = slugs.value.filter((entry) => entry !== slug);
  const removed = compare.items.find((item) => item.slug === slug);
  if (removed) compare.remove(removed.id);
  router.replace({ query: next.length ? { products: next.join(',') } : {} });
}

const winnerIndex = computed(() =>
  data.value?.verdict
    ? data.value.products.findIndex((product) => product.id === data.value?.verdict?.productId)
    : -1,
);

function formatCell(key: string, value: string | number | null): string {
  if (value === null) return '—';
  if (typeof value !== 'number') return value;
  if (key === 'price' || key === 'price-per-100') return formatPrice(value);
  if (key === 'match') return `${value}%`;
  return String(value);
}

useSeo({
  title: 'Compare cosmetics side by side',
  description:
    'Compare up to four cosmetics on price per 100 ml, personal match, ingredient score and key actives — with a clear recommendation at the end.',
  path: '/compare',
});
</script>

<template>
  <div class="container-page py-8 sm:py-12">
    <header class="mb-8 max-w-2xl">
      <h1 class="font-display text-3xl text-ink sm:text-4xl">Compare</h1>
      <p class="mt-2 text-base text-ink-muted">
        Two to four products, measured on the things that actually decide it.
      </p>
    </header>

    <BaseEmptyState
      v-if="slugs.length < 2"
      icon="compare"
      title="Pick at least two products"
      description="Add products from anywhere in the catalogue using the compare button on a product card."
    >
      <BaseButton to="/products">Browse products</BaseButton>
      <BaseButton v-if="compare.count === 1" variant="secondary" to="/discover">
        Find one more
      </BaseButton>
    </BaseEmptyState>

    <BaseErrorState v-else-if="error" @retry="refresh()" />

    <div v-else-if="pending" class="space-y-4">
      <BaseSkeleton height="16rem" />
      <BaseSkeleton height="22rem" />
    </div>

    <template v-else-if="data">
      <!-- Verdict first: it is the answer people came for. -->
      <BaseCard v-if="data.verdict" class="mb-8 border-ink/15 bg-surface">
        <div class="flex flex-wrap items-start gap-5">
          <span class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-ink text-ink-inverse">
            <BaseIcon name="sparkles" :size="20" />
          </span>
          <div class="min-w-0 flex-1">
            <h2 class="font-display text-xl text-ink sm:text-2xl">{{ data.verdict.summary }}</h2>
            <ul class="mt-3 space-y-1.5">
              <li
                v-for="reason in data.verdict.reasons"
                :key="reason"
                class="flex items-start gap-2 text-sm text-ink-soft"
              >
                <BaseIcon name="check" :size="15" class="mt-0.5 shrink-0 text-sage" />
                {{ reason }}
              </li>
            </ul>
          </div>
          <BaseButton
            v-if="winnerIndex >= 0"
            :to="`/products/${data.products[winnerIndex]!.slug}`"
            class="shrink-0"
          >View product</BaseButton>
        </div>
      </BaseCard>

      <!-- Table on desktop; stacked cards on mobile, where a table cannot work. -->
      <div class="hide-scrollbar -mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
        <table class="w-full min-w-[42rem] border-separate border-spacing-0">
          <caption class="sr-only">Product comparison</caption>
          <thead>
            <tr>
              <th scope="col" class="w-40 border-b border-line px-3 pb-4 text-left align-bottom">
                <span class="sr-only">Attribute</span>
              </th>
              <th
                v-for="(product, index) in data.products"
                :key="product.id"
                scope="col"
                class="border-b px-3 pb-4 align-bottom"
                :class="index === winnerIndex ? 'border-ink' : 'border-line'"
              >
                <div class="relative flex flex-col items-center gap-2 text-center">
                  <button
                    type="button"
                    class="absolute -top-1 -right-1 rounded-md p-1 text-ink-faint transition-colors hover:text-critical"
                    :aria-label="`Remove ${product.name}`"
                    @click="removeProduct(product.slug)"
                  >
                    <BaseIcon name="close" :size="14" />
                  </button>
                  <ProductImage
                    :src="product.imageUrl"
                    :alt="`${product.brand.name} ${product.name}`"
                    ratio="square"
                    class="w-20"
                  />
                  <NuxtLink :to="`/products/${product.slug}`" class="min-w-0">
                    <span class="block text-2xs tracking-wide text-ink-muted uppercase">
                      {{ product.brand.name }}
                    </span>
                    <span class="mt-0.5 block text-sm font-medium text-ink hover:underline">
                      {{ product.name }}
                    </span>
                  </NuxtLink>
                  <BaseBadge v-if="index === winnerIndex" tone="sage" size="xs">
                    Kosvia's pick
                  </BaseBadge>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in data.rows" :key="row.key" class="even:bg-surface-muted/60">
              <th scope="row" class="px-3 py-3 text-left text-sm font-medium text-ink-soft">
                {{ row.label }}
              </th>
              <td
                v-for="(value, index) in row.values"
                :key="index"
                class="px-3 py-3 text-center text-sm"
                :class="
                  row.bestIndex === index
                    ? 'font-semibold text-ink'
                    : 'text-ink-soft'
                "
              >
                <span class="inline-flex items-center gap-1.5">
                  <BaseIcon
                    v-if="row.bestIndex === index"
                    name="check"
                    :size="14"
                    class="text-sage"
                  />
                  {{ formatCell(row.key, value) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="mt-6 text-xs text-ink-muted">
        Price per 100 ml is the fairest way to compare products of different sizes.
        Personal Match is computed from your profile, not from reviews.
      </p>
    </template>
  </div>
</template>
