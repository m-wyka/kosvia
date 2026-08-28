<script setup lang="ts">
withDefaults(defineProps<{ size?: number; label?: string }>(), { size: 16 });
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    class="shrink-0 animate-spin"
    role="status"
    :aria-label="label ?? 'Loading'"
  >
    <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-opacity="0.22" stroke-width="2.5" />
    <path
      d="M21 12a9 9 0 0 0-9-9"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
    />
  </svg>
</template>
