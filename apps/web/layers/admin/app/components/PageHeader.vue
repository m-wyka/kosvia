<script setup lang="ts">
defineProps<{ title: string; description?: string; count?: number }>();
</script>

<template>
  <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
    <div class="min-w-0">
      <h1 class="font-display text-2xl text-ink sm:text-3xl">
        {{ title }}
        <span v-if="count !== undefined" class="text-lg text-ink-faint tabular-nums">{{ count }}</span>
      </h1>
      <p v-if="description" class="mt-1 text-sm text-ink-muted">{{ description }}</p>
    </div>
    <div class="flex shrink-0 flex-wrap items-center gap-2">
      <slot name="actions" />
    </div>
  </header>
</template>
