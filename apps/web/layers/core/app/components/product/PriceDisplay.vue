<script setup lang="ts">
import { formatPrice } from '@kosvia/shared';
import type { StoreDto } from '@kosvia/shared';

withDefaults(
  defineProps<{
    price: number | null;
    store?: StoreDto | null;
    size?: 'sm' | 'md' | 'lg';
    perHundred?: number | null;
    unit?: string | null;
  }>(),
  { size: 'md' },
);

const sizes = { sm: 'text-sm', md: 'text-lg', lg: 'text-3xl' };
</script>

<template>
  <div class="min-w-0">
    <p class="font-semibold tracking-tight tabular-nums text-ink" :class="sizes[size]">
      <template v-if="price !== null">{{ formatPrice(price) }}</template>
      <span v-else class="text-ink-muted">Price unavailable</span>
    </p>
    <p v-if="store || perHundred" class="mt-0.5 truncate text-xs text-ink-muted">
      <span v-if="store">at {{ store.name }}</span>
      <span v-if="store && perHundred"> · </span>
      <span v-if="perHundred">{{ formatPrice(perHundred) }} / 100 {{ unit ?? 'ml' }}</span>
    </p>
  </div>
</template>
