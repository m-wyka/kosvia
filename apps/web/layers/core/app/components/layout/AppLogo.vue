<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 26 });
</script>

<template>
  <span class="inline-flex items-center gap-2">
    <svg
      :width="size"
      :height="size"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      class="shrink-0"
    >
      <rect width="32" height="32" rx="9" fill="var(--color-ink)" />
      <path
        d="M16 7.5c3.4 3.2 5.2 6 5.2 8.6a5.2 5.2 0 1 1-10.4 0c0-2.6 1.8-5.4 5.2-8.6Z"
        fill="var(--color-blush)"
      />
      <circle cx="16" cy="16.6" r="1.9" fill="var(--color-ink)" />
    </svg>
    <span class="font-display text-lg tracking-tight text-ink">Kosvia</span>
  </span>
</template>
