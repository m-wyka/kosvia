<script setup lang="ts">
withDefaults(defineProps<{ message: string; ctaLabel?: string; compact?: boolean }>(), {
  ctaLabel: undefined,
  compact: false,
});
</script>

<template>
  <div
    class="@container flex flex-col gap-3 rounded-xl border border-blush/25 bg-blush-soft/60 @2xl:flex-row @2xl:items-center @2xl:gap-4 @5xl:gap-6"
    :class="compact ? 'p-3 @5xl:p-4' : 'p-4 @2xl:p-5 @5xl:p-6'"
  >
    <div class="flex min-w-0 flex-1 items-start gap-3 @2xl:items-center @5xl:gap-4">
      <span
        class="grid size-8 shrink-0 place-items-center rounded-full bg-blush/15 text-blush-deep @5xl:size-11"
      >
        <BaseIcon name="premium" :size="18" class="@5xl:size-6" />
      </span>
      <p class="min-w-0 text-sm leading-relaxed text-ink-soft @5xl:max-w-2xl @5xl:text-base">
        {{ message }}
      </p>
    </div>
    <BaseButton to="/pricing" :size="compact ? 'sm' : 'md'" class="w-full shrink-0 @2xl:w-auto">
      {{ ctaLabel ?? $t('PREMIUM.SEE_PREMIUM') }}
    </BaseButton>
  </div>
</template>
