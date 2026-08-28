<script setup lang="ts">
import { formatPrice, type IngredientScoreBreakdownDto, type ProductDto } from '@kosvia/shared';

/**
 * The product page — the most important SEO surface in the product, and the
 * screen where the whole proposition has to land in one scroll on a phone.
 */
const route = useRoute();
const slug = computed(() => String(route.params.slug));

const { data: product, error, refresh } = await useApiFetch<ProductDto>(
  () => `/products/${slug.value}`,
  { key: () => `product-${slug.value}` },
);

if (error.value) {
  throw createError({
    statusCode: error.value.statusCode ?? 404,
    statusMessage: 'We could not find that product.',
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
  if (!product.value || !alertPrice.value) return;
  alertSaving.value = true;
  try {
    await api('/price-alerts', {
      method: 'POST',
      body: { productId: product.value.id, targetPrice: alertPrice.value },
    });
    alertOpen.value = false;
    toast.success('Price alert created', { label: 'View alerts', to: '/price-alerts' });
  } catch (caught) {
    toast.error(message(caught));
  } finally {
    alertSaving.value = false;
  }
}

const facts = computed(() => {
  const value = product.value;
  if (!value) return [];
  return [
    { label: 'Size', value: formatVolume(value.volume, value.volumeUnit) },
    { label: 'Price per 100 ml', value: value.pricePerHundredMl ? formatPrice(value.pricePerHundredMl) : null },
    { label: 'Ingredients', value: `${value.ingredients.length} on the label` },
    { label: 'Category', value: value.category.name },
  ].filter((fact) => fact.value);
});

const badges = computed(() => {
  const value = product.value;
  if (!value) return [];
  const list: Array<{ label: string; tone: 'sage' | 'lavender' | 'peach' }> = [];
  if (value.isFragranceFree) list.push({ label: 'Fragrance-free', tone: 'sage' });
  if (value.isVegan) list.push({ label: 'Vegan', tone: 'lavender' });
  if (value.isCrueltyFree) list.push({ label: 'Cruelty-free', tone: 'peach' });
  return list;
});

useSeo(() => ({
  title: product.value ? `${product.value.brand.name} ${product.value.name}` : 'Product',
  description: product.value
    ? `${product.value.brand.name} ${product.value.name} — ingredient analysis, personal match score and prices across stores. ${
        product.value.description?.slice(0, 90) ?? ''
      }`.trim()
    : '',
  path: `/products/${slug.value}`,
  image: product.value?.imageUrl ?? undefined,
  type: 'product',
}));

useProductJsonLd(product);
useBreadcrumbJsonLd(
  computed(() => [
    { name: 'Home', path: '/' },
    { name: 'Products', path: '/products' },
    ...(product.value
      ? [
          { name: product.value.category.name, path: `/products?category=${product.value.category.slug}` },
          { name: product.value.name, path: `/products/${product.value.slug}` },
        ]
      : []),
  ]),
);
</script>

<template>
  <div v-if="product" class="container-page py-6 sm:py-10">
    <nav aria-label="Breadcrumb" class="mb-5 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
      <NuxtLink to="/" class="hover:text-ink">Home</NuxtLink>
      <BaseIcon name="chevron-right" :size="12" />
      <NuxtLink to="/products" class="hover:text-ink">Products</NuxtLink>
      <BaseIcon name="chevron-right" :size="12" />
      <NuxtLink :to="`/products?category=${product.category.slug}`" class="hover:text-ink">
        {{ product.category.name }}
      </NuxtLink>
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
        <NuxtLink
          :to="`/products?brand=${product.brand.slug}`"
          class="text-sm font-medium tracking-wide text-ink-muted uppercase underline-offset-4 hover:text-ink hover:underline"
        >{{ product.brand.name }}</NuxtLink>

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
            {{ onShelf ? 'On your shelf' : 'Add to my shelf' }}
          </BaseButton>

          <BaseButton
            size="lg"
            variant="secondary"
            @click="compare.toggle(product)"
          >
            <template #icon><BaseIcon name="compare" :size="17" /></template>
            {{ inComparison ? 'In comparison' : 'Compare' }}
          </BaseButton>

          <BaseButton size="lg" variant="ghost" @click="alertOpen = true">
            <template #icon><BaseIcon name="bell" :size="17" /></template>
            Price alert
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
          <h2 class="font-display text-2xl text-ink">About this product</h2>
          <p class="mt-3 text-base leading-relaxed whitespace-pre-line text-ink-soft">
            {{ product.description }}
          </p>
          <div v-if="product.usage" class="mt-5 rounded-lg border border-line bg-surface p-4">
            <p class="text-sm font-semibold text-ink">How to use it</p>
            <p class="mt-1.5 text-sm leading-relaxed text-ink-soft">{{ product.usage }}</p>
          </div>
        </section>

        <IngredientSummary
          :ingredients="product.ingredients"
          :breakdown="breakdown"
          :score="product.ingredientScore"
        />

        <section>
          <h2 class="font-display text-2xl text-ink">What is in it</h2>
          <p class="mt-1 mb-5 text-sm text-ink-muted">
            Grouped by function. The number is the ingredient's position on the label — earlier
            means more of it.
          </p>
          <IngredientList :ingredients="product.ingredients" />
        </section>

        <ProductAlternatives :slug="product.slug" />
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
      title="Set a price alert"
      :description="`We will flag ${product.name} when it drops to your number.`"
      size="sm"
    >
      <BaseInput
        v-model="alertPrice"
        label="Alert me at or below"
        type="number"
        inputmode="decimal"
        :hint="product.lowestPrice ? `Currently ${formatPrice(product.lowestPrice)}` : undefined"
      >
        <template #suffix><span class="text-sm">PLN</span></template>
      </BaseInput>
      <p class="mt-4 text-xs leading-relaxed text-ink-muted">
        Alerts are evaluated against the offers we hold. Background price watching and
        notifications are not part of this build.
      </p>
      <template #footer>
        <BaseButton variant="ghost" @click="alertOpen = false">Cancel</BaseButton>
        <BaseButton :loading="alertSaving" @click="createAlert">Create alert</BaseButton>
      </template>
    </BaseModal>
  </div>

  <div v-else class="container-page py-20">
    <BaseErrorState
      title="We could not load this product"
      message="It may have been removed, or the connection dropped."
      @retry="refresh()"
    />
  </div>
</template>
