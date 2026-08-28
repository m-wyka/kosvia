<script setup lang="ts">
/**
 * Shown whenever a request fails. Never surfaces a status code — the user gets
 * plain language and a way to try again.
 */
withDefaults(
  defineProps<{ title?: string; message?: string; compact?: boolean }>(),
  {
    title: 'Something went wrong',
    message: 'We could not load this right now. Please try again.',
  },
);

defineEmits<{ retry: [] }>();
</script>

<template>
  <div
    class="flex flex-col items-center justify-center rounded-xl border border-critical/20 bg-critical-soft/50 text-center"
    :class="compact ? 'px-6 py-8' : 'px-6 py-12'"
    role="alert"
  >
    <span class="mb-4 flex size-11 items-center justify-center rounded-full bg-surface text-critical shadow-xs">
      <BaseIcon name="alert" :size="20" />
    </span>
    <h3 class="font-display text-lg text-ink">{{ title }}</h3>
    <p class="mt-1.5 max-w-sm text-sm text-ink-soft">{{ message }}</p>
    <BaseButton variant="secondary" size="sm" class="mt-5" @click="$emit('retry')">
      Try again
    </BaseButton>
  </div>
</template>
