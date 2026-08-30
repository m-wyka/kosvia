<script setup lang="ts">
import type { ProductSummaryDto } from '@kosvia/shared';

type TagTone = 'sage' | 'lavender' | 'peach' | 'neutral';

const POP_ANIMATION_MS = 260;
const MAX_TAGS = 2;
const MAX_CHIP_LABEL_LENGTH = 26;
const CHIP_REASON_CODES = ['concerns', 'goals', 'skin-type'];

const props = withDefaults(
  defineProps<{
    product: ProductSummaryDto;
    variant?: 'grid' | 'rail';
    eager?: boolean;
    showFavorite?: boolean;
    isFavorite?: boolean;
    showCompare?: boolean;
    note?: string;
  }>(),
  { variant: 'grid', showFavorite: true },
);

const emit = defineEmits<{ favorite: [ProductSummaryDto] }>();

const { has: isInCompareTray, toggle: toggleCompare } = useCompareStore();
const { t } = useI18n();
const reasonLabel = useMatchReason();

const popping = ref(false);

const inComparison = computed(() => isInCompareTray(props.product.id));

const topReasonChip = computed(() =>
  props.product.personalMatch?.reasons
    .filter((reason) => CHIP_REASON_CODES.includes(reason.code))
    .map(reasonLabel)
    .find((label) => label.length <= MAX_CHIP_LABEL_LENGTH),
);

const tags = computed(() => {
  const list: Array<{ label: string; tone: TagTone }> = [];
  if (props.product.isFragranceFree) {
    list.push({ label: t('SEARCH.FILTER.FRAGRANCE_FREE'), tone: 'sage' });
  }
  if (props.product.isVegan) {
    list.push({ label: t('SEARCH.FILTER.VEGAN'), tone: 'lavender' });
  }
  if (topReasonChip.value) {
    list.push({ label: topReasonChip.value, tone: 'peach' });
  }
  return list.slice(0, MAX_TAGS);
});

const handleFavoriteClick = () => {
  popping.value = true;
  setTimeout(() => {
    popping.value = false;
  }, POP_ANIMATION_MS);
  emit('favorite', props.product);
};
</script>

<template>
  <article
    class="group relative flex flex-col overflow-hidden rounded-xl border border-line bg-surface transition-all duration-base ease-out-soft hover:-translate-y-0.5 hover:border-line-strong hover:shadow-md focus-within:border-line-strong focus-within:shadow-md"
    :class="variant === 'rail' && 'shrink-0 sm:w-60 w-54'"
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
          class="inline-flex items-center rounded-pill bg-surface/92 px-2.5 py-1 text-xs font-semibold tabular-nums shadow-xs backdrop-blur-sm"
          :class="{
            'text-sage': ['perfect', 'great'].includes(product.personalMatch.tier),
            'text-peach': product.personalMatch.tier === 'good',
            'text-ink-muted': ['fair', 'poor'].includes(product.personalMatch.tier),
          }"
        >
          {{ $t('PRODUCT.MATCH', { score: product.personalMatch.score }) }}
        </span>
      </div>

      <button
        v-if="showFavorite"
        type="button"
        class="absolute top-2 right-2 flex size-9 items-center justify-center rounded-full bg-surface/92 text-ink-muted shadow-xs backdrop-blur-sm transition-colors hover:text-blush-deep"
        :class="[isFavorite && 'text-blush-deep', popping && 'animate-pop']"
        :aria-label="
          isFavorite
            ? $t('PRODUCT.REMOVE_FAVORITE', { name: product.name })
            : $t('PRODUCT.ADD_FAVORITE', { name: product.name })
        "
        :aria-pressed="isFavorite"
        @click.stop.prevent="handleFavoriteClick"
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
          <NuxtLinkLocale :to="`/products/${product.slug}`" class="after:absolute after:inset-0">
            <span class="line-clamp-2">{{ product.name }}</span>
          </NuxtLinkLocale>
        </h3>
      </div>

      <p v-if="note" class="line-clamp-2 text-xs text-ink-muted">{{ note }}</p>
      <div v-else-if="tags.length" class="flex flex-wrap gap-1.5">
        <BaseBadge v-for="tag in tags" :key="tag.label" :tone="tag.tone" size="xs">
          {{ tag.label }}
        </BaseBadge>
      </div>

      <div class="mt-auto flex items-end justify-between gap-2 pt-1">
        <PriceDisplay :price="product.lowestPrice" :store="product.lowestPriceStore" size="sm" />
        <button
          v-if="showCompare"
          type="button"
          class="relative z-10 rounded-md p-1.5 transition-colors"
          :class="
            inComparison
              ? 'bg-ink text-ink-inverse'
              : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
          "
          :aria-label="
            inComparison
              ? $t('PRODUCT.REMOVE_COMPARE', { name: product.name })
              : $t('PRODUCT.ADD_COMPARE', { name: product.name })
          "
          :aria-pressed="inComparison"
          @click.stop.prevent="toggleCompare(product)"
        >
          <BaseIcon name="compare" :size="16" />
        </button>
      </div>
    </div>
  </article>
</template>
