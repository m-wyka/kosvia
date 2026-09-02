<script setup lang="ts">
import type { IngredientDto, ProductDto } from '@kosvia/shared';

interface SharedIngredientEntry {
  ingredient: IngredientDto;
  minPosition: number;
}

const props = defineProps<{ products: ProductDto[] }>();

const PAIR_SIZE = 2;

const ingredientIdSets = computed(() =>
  props.products.map((product) => new Set(product.ingredients.map((entry) => entry.ingredient.id))),
);

const sharedIngredients = computed<SharedIngredientEntry[]>(() => {
  const [firstProduct, ...otherProducts] = props.products;
  if (!firstProduct || !otherProducts.length) {
    return [];
  }
  const otherSets = ingredientIdSets.value.slice(1);
  const entries: SharedIngredientEntry[] = [];
  for (const entry of firstProduct.ingredients) {
    const isInEveryProduct = otherSets.every((set) => set.has(entry.ingredient.id));
    if (!isInEveryProduct) {
      continue;
    }
    const positions = props.products.map(
      (product) =>
        product.ingredients.find((candidate) => candidate.ingredient.id === entry.ingredient.id)
          ?.position ?? entry.position,
    );
    entries.push({ ingredient: entry.ingredient, minPosition: Math.min(...positions) });
  }
  return entries.sort((first, second) => first.minPosition - second.minPosition);
});

const uniquePerProduct = computed(() =>
  props.products.map((product, productIndex) => ({
    product,
    ingredients: product.ingredients
      .filter((entry) =>
        ingredientIdSets.value.every(
          (set, setIndex) => setIndex === productIndex || !set.has(entry.ingredient.id),
        ),
      )
      .map((entry) => entry.ingredient),
  })),
);

const overlapPercent = computed(() => {
  if (props.products.length !== PAIR_SIZE) {
    return null;
  }
  const [firstSet, secondSet] = ingredientIdSets.value;
  if (!firstSet?.size && !secondSet?.size) {
    return null;
  }
  const sharedCount = [...firstSet!].filter((id) => secondSet!.has(id)).length;
  const unionCount = new Set([...firstSet!, ...secondSet!]).size;
  return Math.round((sharedCount / unionCount) * 100);
});

const displayName = (ingredient: IngredientDto): string => {
  return ingredient.commonName ?? ingredient.inciName;
};

const isFlagged = (ingredient: IngredientDto): boolean => {
  return ingredient.regulatory.isProhibited || ingredient.regulatory.isRestricted;
};
</script>

<template>
  <section class="mt-10">
    <h2 class="font-display text-2xl text-ink">
      {{ $t('COMPARE.DIFF.TITLE') }}
    </h2>
    <p v-if="overlapPercent !== null" class="mt-1 text-sm text-ink-muted">
      {{ $t('COMPARE.DIFF.OVERLAP', { percent: overlapPercent }) }}
    </p>

    <div class="mt-5 rounded-xl border border-line bg-surface p-5">
      <h3 class="text-sm font-semibold text-ink">
        {{
          $t('COMPARE.DIFF.SHARED', { count: sharedIngredients.length }, sharedIngredients.length)
        }}
      </h3>
      <p v-if="!sharedIngredients.length" class="mt-2 text-sm text-ink-muted">
        {{ $t('COMPARE.DIFF.NONE_SHARED') }}
      </p>
      <ul v-else class="mt-3 flex flex-wrap gap-1.5">
        <li v-for="entry in sharedIngredients" :key="entry.ingredient.id">
          <NuxtLinkLocale
            :to="`/ingredients/${entry.ingredient.slug}`"
            class="inline-flex items-center gap-1 rounded-pill border px-2.5 py-1 text-xs transition-colors hover:text-ink"
            :class="
              isFlagged(entry.ingredient)
                ? 'border-caution text-ink-soft'
                : 'border-line text-ink-soft hover:border-line-strong'
            "
          >
            <BaseIcon v-if="entry.ingredient.isActiveIngredient" name="molecule" :size="12" />
            {{ displayName(entry.ingredient) }}
          </NuxtLinkLocale>
        </li>
      </ul>
    </div>

    <div class="mt-4 grid gap-4 sm:grid-cols-2">
      <div
        v-for="group in uniquePerProduct"
        :key="group.product.id"
        class="rounded-xl border border-line bg-surface p-5"
      >
        <h3 class="text-sm font-semibold text-ink">
          {{ $t('COMPARE.DIFF.ONLY_IN', { name: group.product.name }) }}
        </h3>
        <p v-if="!group.ingredients.length" class="mt-2 text-sm text-ink-muted">
          {{ $t('COMPARE.DIFF.NONE_UNIQUE') }}
        </p>
        <ul v-else class="mt-3 flex flex-wrap gap-1.5">
          <li v-for="ingredient in group.ingredients" :key="ingredient.id">
            <NuxtLinkLocale
              :to="`/ingredients/${ingredient.slug}`"
              class="inline-flex items-center gap-1 rounded-pill border px-2.5 py-1 text-xs transition-colors hover:text-ink"
              :class="
                isFlagged(ingredient)
                  ? 'border-caution text-ink-soft'
                  : 'border-line text-ink-soft hover:border-line-strong'
              "
            >
              <BaseIcon v-if="ingredient.isActiveIngredient" name="molecule" :size="12" />
              {{ displayName(ingredient) }}
            </NuxtLinkLocale>
          </li>
        </ul>
      </div>
    </div>

    <ul class="mt-4 flex flex-col gap-x-5 gap-y-2 text-xs text-ink-muted">
      <li class="flex items-center gap-1.5">
        <span class="inline-block size-4 rounded-pill border border-caution" aria-hidden="true" />
        {{ $t('COMPARE.DIFF.LEGEND.FLAGGED') }}
      </li>
      <li class="flex items-center gap-1.5">
        <BaseIcon name="molecule" :size="16" aria-hidden="true" />
        {{ $t('COMPARE.DIFF.LEGEND.ACTIVE') }}
      </li>
    </ul>
  </section>
</template>
