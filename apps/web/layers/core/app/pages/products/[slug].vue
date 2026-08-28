<script setup lang="ts">
import type { IngredientScoreBreakdownDto, ProductDto } from '@kosvia/shared';

/**
 * The product page — the most important SEO surface in the product, and the
 * screen where the whole proposition has to land in one scroll on a phone.
 */
const route = useRoute();
const { t } = useI18n();
const vocab = useVocabulary();
const format = useFormat();
const slug = computed(() => String(route.params.slug));

const { data: product, error, refresh } = await useApiFetch<ProductDto>(
  () => `/products/${slug.value}`,
  { key: () => `product-${slug.value}` },
);

if (error.value) {
  throw createError({
    statusCode: error.value.statusCode ?? 404,
    statusMessage: t('PRODUCT.NOT_FOUND'),
    fatal: true,
  });
}

// Secondary data: never blocks the first paint of the page itself.
const { data: breakdown } = await useApiFetch<IngredientScoreBreakdownDto>(
  () => `/products/${slug.value}/ingredient-score`,
  { key: () => `score-${slug.value}`, lazy: true },
);

const shelf = useShelf();
const compare = useCompareStore();
const api = useApi();
const toast = useToast();
const message = useApiMessage();

onMounted(() => shelf.refresh());

const onShelf = computed(() => (product.value ? shelf.has(product.value.id) : false));
const inComparison = computed(() => (product.value ? compare.has(product.value.id) : false));

const alertOpen = ref(false);
const alertPrice = ref<number | null>(null);
const alertSaving = ref(false);

watchEffect(() => {
  if (product.value?.lowestPrice && alertPrice.value === null) {
    alertPrice.value = Math.round(product.value.lowestPrice * 0.85 * 100) / 100;
  }
});

async function createAlert() {
  if (!product.value || !alertPrice.value) {return;}
  alertSaving.value = true;
  try {
    await api('/price-alerts', {
      method: 'POST',
      body: { productId: product.value.id, targetPrice: alertPrice.value },
    });
    alertOpen.value = false;
    toast.success(t('PRODUCT.ALERT_MODAL.CREATED'), {
      label: t('PRODUCT.ALERT_MODAL.VIEW_ALERTS'),
      to: '/price-alerts',
    });
  } catch (caught) {
    toast.error(message(caught));
  } finally {
    alertSaving.value = false;
  }
}

const facts = computed(() => {
  const value = product.value;
  if (!value) {return [];}
  return [
    { label: t('PRODUCT.SIZE'), value: formatVolume(value.volume, value.volumeUnit) },
    {
      label: t('PRODUCT.PRICE_PER_100'),
      value: value.pricePerHundredMl ? format.price(value.pricePerHundredMl) : null,
    },
    {
      label: t('PRODUCT.INGREDIENT_COUNT'),
      value: t('PRODUCT.INGREDIENT_COUNT_VALUE', { count: value.ingredients.length }),
    },
    { label: t('PRODUCT.CATEGORY'), value: vocab.category(value.category.slug, value.category.name) },
  ].filter((fact) => fact.value);
});

const badges = computed(() => {
  const value = product.value;
  if (!value) {return [];}
  const list: Array<{ label: string; tone: 'sage' | 'lavender' | 'peach' }> = [];
  if (value.isFragranceFree) {list.push({ label: t('SEARCH.FILTER.FRAGRANCE_FREE'), tone: 'sage' });}
  if (value.isVegan) {list.push({ label: t('SEARCH.FILTER.VEGAN'), tone: 'lavender' });}
  if (value.isCrueltyFree) {list.push({ label: t('SEARCH.FILTER.CRUELTY_FREE'), tone: 'peach' });}
  return list;
});

useSeo(() => ({
  title: product.value
    ? `${product.value.brand.name} ${product.value.name}`
    : t('SEO.PRODUCT.FALLBACK_TITLE'),
  description: product.value
    ? t('SEO.PRODUCT.DESCRIPTION', {
        name: `${product.value.brand.name} ${product.value.name}`,
      })
    : '',
  path: `/products/${slug.value}`,
  image: product.value?.imageUrl ?? undefined,
  type: 'product',
}));

useProductJsonLd(product);
useBreadcrumbJsonLd(
  computed(() => [
    { name: t('NAV.HOME'), path: '/' },
    { name: t('NAV.PRODUCTS'), path: '/products' },
    ...(product.value
      ? [
          {
            name: vocab.category(product.value.category.slug, product.value.category.name),
            path: `/products?category=${product.value.category.slug}`,
          },
          { name: product.value.name, path: `/products/${product.value.slug}` },
        ]
      : []),
  ]),
);
</script>

<template>
  <div v-if="product" class="container-page py-6 sm:py-10">
    <nav aria-label="Breadcrumb" class="mb-5 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
      <NuxtLinkLocale to="/" class="hover:text-ink">{{ $t('NAV.HOME') }}</NuxtLinkLocale>
      <BaseIcon name="chevron-right" :size="12" />
      <NuxtLinkLocale to="/products" class="hover:text-ink">{{ $t('NAV.PRODUCTS') }}</NuxtLinkLocale>
      <BaseIcon name="chevron-right" :size="12" />
      <NuxtLinkLocale :to="`/products?category=${product.category.slug}`" class="hover:text-ink">
        {{ vocab.category(product.category.slug, product.category.name) }}
      </NuxtLinkLocale>
    </nav>

    <!-- Hero -->
    <div class="grid gap-8 lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-12">
      <div>
        <ProductImage
          :src="product.imageUrl"
          :alt="`${product.brand.name} ${product.name}`"
          ratio="square"
          eager
          sizes="(max-width: 1024px) 100vw, 26rem"
          class="rounded-xl border border-line"
        />
      </div>

      <div class="min-w-0">
        <NuxtLinkLocale
          :to="`/products?brand=${product.brand.slug}`"
          class="text-sm font-medium tracking-wide text-ink-muted uppercase underline-offset-4 hover:text-ink hover:underline"
        >{{ product.brand.name }}</NuxtLinkLocale>

        <h1 class="mt-1.5 font-display text-3xl leading-tight text-ink sm:text-4xl">
          {{ product.name }}
        </h1>

        <div v-if="badges.length" class="mt-4 flex flex-wrap gap-1.5">
          <BaseBadge v-for="badge in badges" :key="badge.label" :tone="badge.tone">
            {{ badge.label }}
          </BaseBadge>
        </div>

        <div class="mt-6 flex flex-wrap items-end justify-between gap-4 border-y border-line py-5">
          <PriceDisplay
            :price="product.lowestPrice"
            :store="product.lowestPriceStore"
            :per-hundred="product.pricePerHundredMl"
            :unit="product.volumeUnit"
            size="lg"
          />
          <MatchScore :match="product.personalMatch" size="md" animate />
        </div>

        <div class="mt-6 flex flex-wrap gap-2.5">
          <BaseButton
            size="lg"
            :variant="onShelf ? 'secondary' : 'primary'"
            :loading="shelf.busy.value"
            @click="onShelf ? undefined : shelf.add(product)"
          >
            <template #icon>
              <BaseIcon :name="onShelf ? 'check' : 'plus'" :size="17" />
            </template>
            {{ onShelf ? $t('PRODUCT.ON_SHELF') : $t('PRODUCT.ADD_TO_SHELF') }}
          </BaseButton>

          <BaseButton
            size="lg"
            variant="secondary"
            @click="compare.toggle(product)"
          >
            <template #icon><BaseIcon name="compare" :size="17" /></template>
            {{ inComparison ? $t('PRODUCT.IN_COMPARISON') : $t('PRODUCT.COMPARE') }}
          </BaseButton>

          <BaseButton size="lg" variant="ghost" @click="alertOpen = true">
            <template #icon><BaseIcon name="bell" :size="17" /></template>
            {{ $t('PRODUCT.PRICE_ALERT') }}
          </BaseButton>
        </div>

        <ul v-if="product.highlights.length" class="mt-7 space-y-2.5">
          <li
            v-for="highlight in product.highlights"
            :key="highlight"
            class="flex items-start gap-2.5 text-sm text-ink-soft"
          >
            <span class="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-sage-soft text-sage">
              <BaseIcon name="check" :size="12" :stroke-width="2.2" />
            </span>
            {{ highlight }}
          </li>
        </ul>

        <dl v-if="facts.length" class="mt-7 grid grid-cols-2 gap-x-6 gap-y-4">
          <div v-for="fact in facts" :key="fact.label">
            <dt class="text-xs text-ink-muted">{{ fact.label }}</dt>
            <dd class="mt-0.5 text-sm font-medium text-ink">{{ fact.value }}</dd>
          </div>
        </dl>
      </div>
    </div>

    <!-- Body -->
    <div class="mt-12 grid gap-8 lg:grid-cols-[1fr_22rem] lg:gap-10">
      <div class="min-w-0 space-y-10">
        <section v-if="product.description">
          <h2 class="font-display text-2xl text-ink">{{ $t('PRODUCT.ABOUT_TITLE') }}</h2>
          <p class="mt-3 text-base leading-relaxed whitespace-pre-line text-ink-soft">
            {{ product.description }}
          </p>
          <div v-if="product.usage" class="mt-5 rounded-lg border border-line bg-surface p-4">
            <p class="text-sm font-semibold text-ink">{{ $t('PRODUCT.USAGE_TITLE') }}</p>
            <p class="mt-1.5 text-sm leading-relaxed text-ink-soft">{{ product.usage }}</p>
          </div>
        </section>

        <IngredientSummary
          :ingredients="product.ingredients"
          :breakdown="breakdown"
          :score="product.ingredientScore"
        />

        <section>
          <h2 class="font-display text-2xl text-ink">{{ $t('PRODUCT.WHAT_IS_IN_IT') }}</h2>
          <p class="mt-1 mb-5 text-sm text-ink-muted">{{ $t('PRODUCT.WHAT_IS_IN_IT_SUBTITLE') }}</p>
          <IngredientList :ingredients="product.ingredients" />
        </section>

        <ProductAlternatives :slug="product.slug" :name="product.name" />
      </div>

      <aside class="space-y-6 lg:sticky lg:top-24 lg:self-start">
        <ProductMatchPanel
          v-if="product.personalMatch"
          :match="product.personalMatch"
          :slug="product.slug"
        />
        <ProductOffers :product="product" />
      </aside>
    </div>

    <BaseModal
      v-model:open="alertOpen"
      :title="$t('PRODUCT.ALERT_MODAL.TITLE')"
      :description="$t('PRODUCT.ALERT_MODAL.BODY', { name: product.name })"
      size="sm"
    >
      <BaseInput
        v-model="alertPrice"
        :label="$t('PRODUCT.ALERT_MODAL.LABEL')"
        type="number"
        inputmode="decimal"
        :hint="
          product.lowestPrice
            ? $t('PRODUCT.ALERT_MODAL.CURRENTLY', { price: format.price(product.lowestPrice) })
            : undefined
        "
      >
        <template #suffix><span class="text-sm">{{ format.currencyUnit.value }}</span></template>
      </BaseInput>
      <p class="mt-4 text-xs leading-relaxed text-ink-muted">
        {{ $t('PRODUCT.ALERT_MODAL.NOTE') }}
      </p>
      <template #footer>
        <BaseButton variant="ghost" @click="alertOpen = false">{{ $t('COMMON.CANCEL') }}</BaseButton>
        <BaseButton :loading="alertSaving" @click="createAlert">
          {{ $t('PRODUCT.ALERT_MODAL.CREATE') }}
        </BaseButton>
      </template>
    </BaseModal>
  </div>

  <div v-else class="container-page py-20">
    <BaseErrorState
      :title="$t('PRODUCT.NOT_FOUND_TITLE')"
      :message="$t('PRODUCT.NOT_FOUND_BODY')"
      @retry="refresh()"
    />
  </div>
</template>
