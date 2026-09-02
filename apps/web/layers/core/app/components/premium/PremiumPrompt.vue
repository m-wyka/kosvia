<script setup lang="ts">
withDefaults(defineProps<{ message: string; ctaLabel?: string; compact?: boolean }>(), {
  ctaLabel: undefined,
  compact: false,
});
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-3 rounded-xl border border-blush/25 bg-blush-soft/60"
    :class="compact ? 'p-3' : 'p-4 sm:p-5'"
  >
    <BaseIcon name="sparkles" :size="18" class="shrink-0 text-blush-deep" />
    <p class="min-w-0 flex-1 text-sm text-ink-soft">
      {{ message }}
    </p>
    <BaseButton to="/pricing" size="sm">
      {{ ctaLabel ?? $t('PREMIUM.SEE_PREMIUM') }}
    </BaseButton>
  </div>
</template>
