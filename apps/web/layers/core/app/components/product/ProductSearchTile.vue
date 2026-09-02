<script setup lang="ts">
import type { ProductSummaryDto } from '@kosvia/shared';

const props = defineProps<{ product: ProductSummaryDto }>();

const format = useFormat();

const matchToneClass = computed(() => {
  const tier = props.product.personalMatch?.tier;
  if (tier === 'perfect' || tier === 'great') {
    return 'bg-sage-soft text-sage';
  }
  if (tier === 'good') {
    return 'bg-peach-soft text-peach';
  }
  return 'bg-surface-muted text-ink-muted';
});
</script>

<template>
  <NuxtLinkLocale
    :to="`/products/${product.slug}`"
    class="flex items-center gap-3 rounded-xl border border-line bg-surface p-2.5 shadow-xs transition-all duration-fast ease-out-soft hover:-translate-y-0.5 hover:border-line-strong hover:shadow-md"
  >
    <ProductImage
      :src="product.imageUrl"
      :alt="`${product.brand.name} ${product.name}`"
      ratio="square"
      sizes="56px"
      class="w-14 shrink-0"
    />

    <span class="min-w-0 flex-1">
      <span class="block truncate text-2xs font-medium tracking-wide text-ink-muted uppercase">
        {{ product.brand.name }}
      </span>
      <span class="mt-0.5 line-clamp-2 block text-sm leading-snug font-medium text-ink">
        {{ product.name }}
      </span>
      <span class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span
          v-if="product.personalMatch"
          class="inline-flex items-center rounded-pill px-1.5 py-0.5 text-2xs font-semibold tabular-nums"
          :class="matchToneClass"
        >
          {{ $t('PRODUCT.MATCH', { score: product.personalMatch.score }) }}
        </span>
        <span
          v-if="product.lowestPrice !== null"
          class="text-sm font-semibold tabular-nums text-ink"
        >
          {{ format.price(product.lowestPrice) }}
        </span>
        <span v-else class="text-xs text-ink-muted">
          {{ $t('PRODUCT.PRICE_UNAVAILABLE') }}
        </span>
      </span>
    </span>
  </NuxtLinkLocale>
</template>
