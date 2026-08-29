<script setup lang="ts">
import type { IngredientDto, ProductSearchResult } from '@kosvia/shared';

type ToleranceTone = 'sage' | 'neutral' | 'peach' | 'blush';

const RELATED_PRODUCTS_PAGE_SIZE = 8;

const TOLERANCE_LEVELS: Array<{ minImpact: number; key: string; tone: ToleranceTone }> = [
  { minImpact: 2, key: 'CALMING', tone: 'sage' },
  { minImpact: 1, key: 'WELL_TOLERATED', tone: 'sage' },
  { minImpact: 0, key: 'NEUTRAL', tone: 'neutral' },
  { minImpact: -1, key: 'OCCASIONAL', tone: 'peach' },
];
const REACTIVE_LEVEL = { key: 'REACTIVE', tone: 'blush' as ToleranceTone };

const route = useRoute();
const { t } = useI18n();
const vocab = useVocabulary();
const slug = computed(() => String(route.params.slug));

const { data: ingredient, error } = await useApiFetch<IngredientDto>(
  () => `/ingredients/${slug.value}`,
  { key: () => `ingredient-${slug.value}` },
);

if (error.value) {
  throw createError({ statusCode: 404, statusMessage: t('ERRORS.NOT_FOUND_TITLE'), fatal: true });
}

const { data: products } = await useApiFetch<ProductSearchResult>(
  () =>
    `/products?ingredient=${slug.value}&pageSize=${RELATED_PRODUCTS_PAGE_SIZE}&sort=ingredient-score`,
  { key: () => `ingredient-products-${slug.value}`, lazy: true },
);

const tolerance = computed(() => {
  const impact = ingredient.value?.sensitivityImpact ?? 0;
  const level = TOLERANCE_LEVELS.find((entry) => impact >= entry.minImpact) ?? REACTIVE_LEVEL;
  return { label: t(`INGREDIENTS.TOLERANCE_LEVEL.${level.key}`), tone: level.tone };
});

useSeo(() => ({
  title: ingredient.value
    ? t('SEO.INGREDIENTS.DETAIL_TITLE', {
        name: ingredient.value.commonName ?? ingredient.value.inciName,
      })
    : t('SEO.INGREDIENTS.FALLBACK_TITLE'),
  description: ingredient.value?.description ?? '',
  path: `/ingredients/${slug.value}`,
}));
</script>

<template>
  <div v-if="ingredient" class="container-page py-8 sm:py-12">
    <nav aria-label="Breadcrumb" class="mb-5 flex items-center gap-1.5 text-xs text-ink-muted">
      <NuxtLinkLocale to="/" class="hover:text-ink">{{ $t('NAV.HOME') }}</NuxtLinkLocale>
      <BaseIcon name="chevron-right" :size="12" />
      <NuxtLinkLocale to="/ingredients" class="hover:text-ink">
        {{ $t('FOOTER.INGREDIENT_LIBRARY') }}
      </NuxtLinkLocale>
    </nav>

    <header>
      <h1 class="font-display text-3xl text-ink sm:text-4xl">
        {{ ingredient.commonName ?? ingredient.inciName }}
      </h1>
      <p v-if="ingredient.commonName" class="mt-1 text-sm text-ink-muted">
        {{ $t('INGREDIENTS.INCI', { name: ingredient.inciName }) }}
      </p>
      <div class="mt-4 flex flex-wrap gap-1.5">
        <IngredientBadge v-for="tag in ingredient.tags" :key="tag" :tag="tag" size="sm" />
        <BaseBadge v-if="ingredient.isActiveIngredient" tone="peach">
          {{ $t('INGREDIENTS.ACTIVE_INGREDIENT') }}
        </BaseBadge>
      </div>
    </header>

    <p class="mt-6 max-w-2xl text-base leading-relaxed text-ink-soft">
      {{ ingredient.description }}
    </p>

    <div class="mt-8 grid gap-4 sm:grid-cols-2">
      <BaseCard v-if="ingredient.functions.length">
        <h2 class="text-sm font-semibold text-ink">{{ $t('INGREDIENTS.WHAT_IT_DOES') }}</h2>
        <ul class="mt-3 space-y-2">
          <li
            v-for="fn in ingredient.functions"
            :key="fn"
            class="flex items-start gap-2 text-sm text-ink-soft"
          >
            <BaseIcon name="check" :size="15" class="mt-0.5 shrink-0 text-sage" />
            {{ fn }}
          </li>
        </ul>
      </BaseCard>

      <BaseCard>
        <h2 class="text-sm font-semibold text-ink">{{ $t('INGREDIENTS.TOLERANCE') }}</h2>
        <div class="mt-3 space-y-3">
          <BaseBadge :tone="tolerance.tone">{{ tolerance.label }}</BaseBadge>
          <p v-if="ingredient.comedogenicRating !== null" class="text-sm text-ink-soft">
            {{ $t('INGREDIENTS.COMEDOGENIC', { rating: ingredient.comedogenicRating }) }}
            <span class="mt-0.5 block text-xs text-ink-muted">
              {{ $t('INGREDIENTS.COMEDOGENIC_NOTE') }}
            </span>
          </p>
          <div v-if="ingredient.goodForSkinTypes.length">
            <p class="text-sm text-ink-soft">{{ $t('INGREDIENTS.COMMONLY_SUITS') }}</p>
            <div class="mt-1.5 flex flex-wrap gap-1.5">
              <BaseBadge
                v-for="type in ingredient.goodForSkinTypes"
                :key="type"
                tone="neutral"
                size="xs"
              >
                {{ vocab.skinType(type) }}
              </BaseBadge>
            </div>
          </div>
        </div>
      </BaseCard>
    </div>

    <div
      v-if="ingredient.concerns"
      class="mt-4 flex items-start gap-3 rounded-xl border border-caution/25 bg-caution-soft p-4"
    >
      <BaseIcon name="info" :size="18" class="mt-0.5 shrink-0 text-caution" />
      <div>
        <p class="text-sm font-medium text-ink">{{ $t('INGREDIENTS.WORTH_KNOWING') }}</p>
        <p class="mt-1 text-sm leading-relaxed text-ink-soft">{{ ingredient.concerns }}</p>
      </div>
    </div>

    <section v-if="products?.items.length" class="mt-12">
      <h2 class="font-display text-2xl text-ink">{{ $t('INGREDIENTS.PRODUCTS_TITLE') }}</h2>
      <p class="mt-1 mb-5 text-sm text-ink-muted">
        {{ $t('INGREDIENTS.PRODUCTS_SUBTITLE', { count: products.total }) }}
      </p>
      <ProductGrid :products="products.items" :columns="4" />
    </section>
  </div>
</template>
