<script setup lang="ts">
withDefaults(defineProps<{ width?: string; height?: string; rounded?: string; lines?: number }>(), {
  height: '1rem',
  rounded: 'var(--radius-sm)',
});
</script>

<template>
  <div v-if="lines && lines > 1" class="space-y-2" aria-hidden="true">
    <div
      v-for="line in lines"
      :key="line"
      class="skeleton"
      :style="{
        height,
        borderRadius: rounded,
        width: line === lines ? '65%' : (width ?? '100%'),
      }"
    />
  </div>
  <div
    v-else
    class="skeleton"
    aria-hidden="true"
    :style="{ width: width ?? '100%', height, borderRadius: rounded }"
  />
</template>
