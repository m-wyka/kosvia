<script setup lang="ts">
import type { StoreDto } from '@kosvia/shared';

defineProps<{ store: StoreDto; size?: 'xs' | 'sm' }>();
</script>

<template>
  <BaseBadge tone="neutral" :size="size ?? 'xs'">
    <template #icon>
      <BaseIcon name="store" :size="12" />
    </template>
    {{ store.name }}
  </BaseBadge>
</template>
