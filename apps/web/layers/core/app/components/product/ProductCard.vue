<script setup lang="ts">
import type { ProductSummaryDto } from '@kosvia/shared';

/**
 * The product card, used everywhere a product appears: search results,
 * discovery rails, AI answers, alternatives, the shelf. One card, one set of
 * behaviours — nothing re-implements this markup.
 */
const props = withDefaults(
  defineProps<{
    product: ProductSummaryDto;
    /** `rail` is narrower, for horizontal carousels. */
    variant?: 'grid' | 'rail';
    eager?: boolean;
    showFavorite?: boolean;
    isFavorite?: boolean;
    showCompare?: boolean;
    /** Replaces the default tag row, e.g. with an alternative's reason. */
    note?: string;
  }>(),
  { variant: 'grid', showFavorite: true },
);

const emit = defineEmits<{ favorite: [ProductSummaryDto] }>();

const compare = useCompareStore();
const inComparison = computed(() => compare.has(props.product.id));

const popping = ref(false);
function onFavorite() {
  popping.value = true;
  setTimeout(() => (popping.value = false), 260);
  emit('favorite', props.product);
}

const tags = computed(() => {
  const list: Array<{ label: string; tone: 'sage' | 'lavender' | 'peach' | 'neutral' }> = [];
  if (props.product.isFragranceFree) list.push({ label: 'Fragrance-free', tone: 'sage' });
  if (props.product.isVegan) list.push({ label: 'Vegan', tone: 'lavender' });
  // A match reason only earns a chip if it stays on one line — "Targets
  // dehydration, redness, pores, uneven tone" is a sentence, not a tag.
  const top = props.product.personalMatch?.reasons.find(
    (reason) =>
      ['concerns', 'goals', 'skin-type'].includes(reason.code) && reason.label.length <= 26,
  );
  if (top && list.length < 3) list.push({ label: top.label, tone: 'peach' });
  return list.slice(0, 2);
});
</script>

<template>
  <article
    class="group relative flex flex-col overflow-hidden rounded-xl border border-line bg-surface
           transition-all duration-[--duration-base] ease-[--ease-out-soft]
           hover:-translate-y-0.5 hover:border-line-strong hover:shadow-md
           focus-within:border-line-strong focus-within:shadow-md"
    :class="variant === 'rail' && 'w-[13.5rem] shrink-0 sm:w-60'"
  >
    <div class="relative">
      <ProductImage
        :src="product.imageUrl"
        :alt="`${product.brand.name} ${product.name}`"
        ratio="square"
        :eager="eager"
        sizes="(max-width: 640px) 45vw, 240px"
      />

      <div v-if="product.personalMatch" class="absolute top-2.5 left-2.5">
        <span
          class="inline-flex items-center rounded-pill bg-surface/92 px-2.5 py-1 text-xs font-semibold
                 tabular-nums shadow-xs backdrop-blur-sm"
          :class="{
            'text-sage': ['perfect', 'great'].includes(product.personalMatch.tier),
            'text-peach': product.personalMatch.tier === 'good',
            'text-ink-muted': ['fair', 'poor'].includes(product.personalMatch.tier),
          }"
        >{{ product.personalMatch.score }}% match</span>
      </div>

      <button
        v-if="showFavorite"
        type="button"
        class="absolute top-2 right-2 flex size-9 items-center justify-center rounded-full
               bg-surface/92 text-ink-muted shadow-xs backdrop-blur-sm transition-colors
               hover:text-blush-deep"
        :class="[isFavorite && 'text-blush-deep', popping && 'animate-pop']"
        :aria-label="isFavorite ? `Remove ${product.name} from favourites` : `Add ${product.name} to favourites`"
        :aria-pressed="isFavorite"
        @click.stop.prevent="onFavorite"
      >
        <BaseIcon :name="isFavorite ? 'heart-filled' : 'heart'" :size="17" />
      </button>
    </div>

    <div class="flex flex-1 flex-col gap-2.5 p-3.5">
      <div class="min-w-0">
        <p class="truncate text-2xs font-medium tracking-wide text-ink-muted uppercase">
          {{ product.brand.name }}
        </p>
        <h3 class="mt-0.5 text-sm leading-snug font-medium text-ink">
          <NuxtLink :to="`/products/${product.slug}`" class="after:absolute after:inset-0">
            <span class="line-clamp-2">{{ product.name }}</span>
          </NuxtLink>
        </h3>
      </div>

      <p v-if="note" class="line-clamp-2 text-xs text-ink-muted">{{ note }}</p>
      <div v-else-if="tags.length" class="flex flex-wrap gap-1.5">
        <BaseBadge v-for="tag in tags" :key="tag.label" :tone="tag.tone" size="xs">
          {{ tag.label }}
        </BaseBadge>
      </div>

      <div class="mt-auto flex items-end justify-between gap-2 pt-1">
        <PriceDisplay
          :price="product.lowestPrice"
          :store="product.lowestPriceStore"
          size="sm"
        />
        <button
          v-if="showCompare"
          type="button"
          class="relative z-10 rounded-md p-1.5 transition-colors"
          :class="inComparison ? 'bg-ink text-ink-inverse' : 'text-ink-muted hover:bg-surface-muted hover:text-ink'"
          :aria-label="inComparison ? `Remove ${product.name} from comparison` : `Add ${product.name} to comparison`"
          :aria-pressed="inComparison"
          @click.stop.prevent="compare.toggle(product)"
        >
          <BaseIcon name="compare" :size="16" />
        </button>
      </div>
    </div>
  </article>
</template>
