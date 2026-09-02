<script setup lang="ts">
import type { ProductSummaryDto } from '@kosvia/shared';

withDefaults(
  defineProps<{
    products?: ProductSummaryDto[];
    loading?: boolean;
    skeletonCount?: number;
    showCompare?: boolean;
    columns?: 3 | 4;
  }>(),
  { skeletonCount: 8, columns: 4 },
);
</script>

<template>
  <div
    class="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3"
    :class="columns === 4 ? 'xl:grid-cols-4' : 'lg:grid-cols-3'"
  >
    <template v-if="loading">
      <ProductCardSkeleton v-for="index in skeletonCount" :key="`skeleton-${index}`" />
    </template>
    <template v-else>
      <ProductCard
        v-for="(product, index) in products"
        :key="product.id"
        :product="product"
        :eager="index < 4"
        :show-compare="showCompare"
      />
    </template>
  </div>
</template>
