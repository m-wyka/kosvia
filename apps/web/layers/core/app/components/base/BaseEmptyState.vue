<script setup lang="ts">
withDefaults(
  defineProps<{ icon?: string; title: string; description?: string; compact?: boolean }>(),
  { icon: 'sparkles' },
);
</script>

<template>
  <div
    class="flex flex-col items-center justify-center rounded-xl border border-dashed border-line-strong bg-surface-muted/60 text-center"
    :class="compact ? 'px-6 py-8' : 'px-6 py-14'"
  >
    <span
      class="mb-4 flex size-12 items-center justify-center rounded-full bg-surface text-ink-muted shadow-xs"
    >
      <BaseIcon :name="icon as never" :size="22" />
    </span>
    <h3 class="font-display text-lg text-ink">{{ title }}</h3>
    <p v-if="description" class="mt-1.5 max-w-sm text-sm text-ink-muted">{{ description }}</p>
    <div v-if="$slots.default" class="mt-5 flex flex-wrap justify-center gap-2">
      <slot />
    </div>
  </div>
</template>
