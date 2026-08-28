<script setup lang="ts">
import type { IngredientDto, ProductSearchResult } from '@kosvia/shared';

const route = useRoute();
const slug = computed(() => String(route.params.slug));

const { data: ingredient, error } = await useApiFetch<IngredientDto>(
  () => `/ingredients/${slug.value}`,
  { key: () => `ingredient-${slug.value}` },
);

if (error.value) {
  throw createError({ statusCode: 404, statusMessage: 'Ingredient not found', fatal: true });
}

const { data: products } = await useApiFetch<ProductSearchResult>(
  () => `/products?ingredient=${slug.value}&pageSize=8&sort=ingredient-score`,
  { key: () => `ingredient-products-${slug.value}`, lazy: true },
);

const tolerance = computed(() => {
  const value = ingredient.value?.sensitivityImpact ?? 0;
  if (value >= 2) return { label: 'Actively calming', tone: 'sage' as const };
  if (value === 1) return { label: 'Generally well tolerated', tone: 'sage' as const };
  if (value === 0) return { label: 'Neutral', tone: 'neutral' as const };
  if (value === -1) return { label: 'Occasionally reactive', tone: 'peach' as const };
  return { label: 'Often reported as reactive', tone: 'blush' as const };
});

useSeo(() => ({
  title: ingredient.value
    ? `${ingredient.value.commonName ?? ingredient.value.inciName} in cosmetics`
    : 'Ingredient',
  description: ingredient.value?.description ?? '',
  path: `/ingredients/${slug.value}`,
}));
</script>

<template>
  <div v-if="ingredient" class="container-page max-w-4xl py-8 sm:py-12">
    <nav aria-label="Breadcrumb" class="mb-5 flex items-center gap-1.5 text-xs text-ink-muted">
      <NuxtLink to="/" class="hover:text-ink">Home</NuxtLink>
      <BaseIcon name="chevron-right" :size="12" />
      <NuxtLink to="/ingredients" class="hover:text-ink">Ingredients</NuxtLink>
    </nav>

    <header>
      <h1 class="font-display text-3xl text-ink sm:text-4xl">
        {{ ingredient.commonName ?? ingredient.inciName }}
      </h1>
      <p v-if="ingredient.commonName" class="mt-1 text-sm text-ink-muted">
        INCI: {{ ingredient.inciName }}
      </p>
      <div class="mt-4 flex flex-wrap gap-1.5">
        <IngredientBadge v-for="tag in ingredient.tags" :key="tag" :tag="tag" size="sm" />
        <BaseBadge v-if="ingredient.isActiveIngredient" tone="peach">Active ingredient</BaseBadge>
      </div>
    </header>

    <p class="mt-6 max-w-2xl text-base leading-relaxed text-ink-soft">
      {{ ingredient.description }}
    </p>

    <div class="mt-8 grid gap-4 sm:grid-cols-2">
      <BaseCard v-if="ingredient.functions.length">
        <h2 class="text-sm font-semibold text-ink">What it does</h2>
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
        <h2 class="text-sm font-semibold text-ink">Tolerance</h2>
        <div class="mt-3 space-y-3">
          <BaseBadge :tone="tolerance.tone">{{ tolerance.label }}</BaseBadge>
          <p v-if="ingredient.comedogenicRating !== null" class="text-sm text-ink-soft">
            Comedogenic rating: <span class="font-medium">{{ ingredient.comedogenicRating }} / 5</span>
            <span class="mt-0.5 block text-xs text-ink-muted">
              A rough historical scale, not a guarantee for any individual.
            </span>
          </p>
          <div v-if="ingredient.goodForSkinTypes.length">
            <p class="text-sm text-ink-soft">Commonly suits</p>
            <div class="mt-1.5 flex flex-wrap gap-1.5">
              <BaseBadge
                v-for="type in ingredient.goodForSkinTypes"
                :key="type"
                tone="neutral"
                size="xs"
                class="capitalize"
              >{{ type.toLowerCase() }}</BaseBadge>
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
        <p class="text-sm font-medium text-ink">Worth knowing</p>
        <p class="mt-1 text-sm leading-relaxed text-ink-soft">{{ ingredient.concerns }}</p>
      </div>
    </div>

    <section v-if="products?.items.length" class="mt-12">
      <h2 class="font-display text-2xl text-ink">Products containing it</h2>
      <p class="mt-1 mb-5 text-sm text-ink-muted">
        {{ products.total }} in the catalogue — the best-formulated first.
      </p>
      <ProductGrid :products="products.items" :columns="4" />
    </section>
  </div>
</template>
