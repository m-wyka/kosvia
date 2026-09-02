<script setup lang="ts">
import type { ComparisonResultDto } from '@kosvia/shared';

const MIN_PRODUCTS_TO_COMPARE = 2;
const MONEY_ROW_KEYS = ['price', 'price-per-100'];

const route = useRoute();
const router = useRouter();
const { items: trayItems, count: trayCount } = storeToRefs(useCompareStore());
const { hydrate, remove: removeFromTray } = useCompareStore();
const { t } = useI18n();
const format = useFormat();
const localise = useLocalisedText();

const slugs = computed(() =>
  String(route.query.products ?? '')
    .split(',')
    .filter(Boolean),
);

const { data, pending, error, refresh } = await useApiFetch<ComparisonResultDto>(
  () => `/compare?products=${slugs.value.join(',')}`,
  {
    key: 'comparison',
    watch: [slugs],
    immediate: slugs.value.length >= MIN_PRODUCTS_TO_COMPARE,
  },
);

const winnerIndex = computed(() =>
  data.value?.verdict
    ? data.value.products.findIndex((product) => product.id === data.value?.verdict?.productId)
    : -1,
);

const removeProduct = (slug: string) => {
  const remainingSlugs = slugs.value.filter((entry) => entry !== slug);
  const removed = trayItems.value.find((item) => item.slug === slug);
  if (removed) {
    removeFromTray(removed.id);
  }
  router.replace({ query: remainingSlugs.length ? { products: remainingSlugs.join(',') } : {} });
};

const formatCell = (key: string, value: string | number | null): string => {
  if (value === null) {
    return t('COMMON.NOT_AVAILABLE');
  }
  if (typeof value !== 'number') {
    return value;
  }
  if (MONEY_ROW_KEYS.includes(key)) {
    return format.price(value);
  }
  if (key === 'match') {
    return `${value}%`;
  }
  return String(value);
};

const rowLabel = (key: string): string => {
  return t(`COMPARE.ROW.${key.replace(/-/g, '_').toUpperCase()}`);
};

const seedQueryFromTray = () => {
  if (route.query.products || trayItems.value.length < MIN_PRODUCTS_TO_COMPARE) {
    return;
  }
  router.replace({ query: { products: trayItems.value.map((item) => item.slug).join(',') } });
};

onMounted(() => {
  hydrate();
  seedQueryFromTray();
});

useSeo(() => ({
  title: t('SEO.COMPARE.TITLE'),
  description: t('SEO.COMPARE.DESCRIPTION'),
  path: '/compare',
}));
</script>

<template>
  <div class="container-page py-8 sm:py-12">
    <header class="mb-8 max-w-2xl">
      <h1 class="font-display text-3xl text-ink sm:text-4xl">{{ $t('COMPARE.TITLE') }}</h1>
      <p class="mt-2 text-base text-ink-muted">{{ $t('COMPARE.SUBTITLE') }}</p>
    </header>

    <BaseEmptyState
      v-if="slugs.length < 2"
      icon="compare"
      :title="$t('COMPARE.EMPTY_TITLE')"
      :description="$t('COMPARE.EMPTY_BODY')"
    >
      <BaseButton to="/products">{{ $t('COMPARE.BROWSE') }}</BaseButton>
      <BaseButton v-if="trayCount === 1" variant="secondary" to="/discover">
        {{ $t('COMPARE.FIND_ONE_MORE') }}
      </BaseButton>
    </BaseEmptyState>

    <BaseErrorState v-else-if="error" @retry="refresh()" />

    <div v-else-if="pending" class="space-y-4">
      <BaseSkeleton height="16rem" />
      <BaseSkeleton height="22rem" />
    </div>

    <template v-else-if="data">
      <BaseCard v-if="data.verdict" class="mb-8 border-ink/15 bg-surface">
        <div class="flex flex-wrap items-start gap-5">
          <span
            class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-ink text-ink-inverse"
          >
            <BaseIcon name="match" :size="20" />
          </span>
          <div class="min-w-0 flex-1">
            <h2 class="font-display text-xl text-ink sm:text-2xl">
              {{ localise(data.verdict.summary) }}
            </h2>
            <ul class="mt-3 space-y-1.5">
              <li
                v-for="reason in data.verdict.reasons"
                :key="reason.code"
                class="flex items-start gap-2 text-sm text-ink-soft"
              >
                <BaseIcon name="check" :size="15" class="mt-0.5 shrink-0 text-sage" />
                {{ localise(reason) }}
              </li>
            </ul>
          </div>
          <BaseButton
            v-if="winnerIndex >= 0"
            :to="`/products/${data.products[winnerIndex]!.slug}`"
            class="shrink-0"
          >
            {{ $t('COMPARE.VIEW_PRODUCT') }}
          </BaseButton>
        </div>
      </BaseCard>

      <div class="hide-scrollbar -mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
        <table class="w-full min-w-168 border-separate border-spacing-0">
          <caption class="sr-only">{{ $t('COMPARE.CAPTION') }}</caption>
          <thead>
            <tr>
              <th scope="col" class="w-40 border-b border-line px-3 pb-4 text-left align-bottom">
                <span class="sr-only">{{ $t('COMPARE.ATTRIBUTE') }}</span>
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
                    :aria-label="$t('COMPARE.REMOVE', { name: product.name })"
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
                  <NuxtLinkLocale :to="`/products/${product.slug}`" class="min-w-0">
                    <span class="block text-2xs tracking-wide text-ink-muted uppercase">
                      {{ product.brand.name }}
                    </span>
                    <span class="mt-0.5 block text-sm font-medium text-ink hover:underline">
                      {{ product.name }}
                    </span>
                  </NuxtLinkLocale>
                  <BaseBadge v-if="index === winnerIndex" tone="sage" size="xs">
                    {{ $t('COMPARE.OUR_PICK') }}
                  </BaseBadge>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in data.rows" :key="row.key" class="even:bg-surface-muted/60">
              <th scope="row" class="px-3 py-3 text-left text-sm font-medium text-ink-soft">
                {{ rowLabel(row.key) }}
              </th>
              <td
                v-for="(value, index) in row.values"
                :key="index"
                class="px-3 py-3 text-center text-sm"
                :class="row.bestIndex === index ? 'font-semibold text-ink' : 'text-ink-soft'"
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

      <CompareIngredientsDiff :products="data.products" />

      <p class="mt-6 text-xs text-ink-muted">
        {{ $t('COMPARE.NOTE') }}
      </p>
    </template>
  </div>
</template>
