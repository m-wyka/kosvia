<template>
  <div class="flex gap-2.5" role="status" :aria-label="$t('AI.THINKING_ARIA')">
    <span
      class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-blush-soft text-blush-deep"
      aria-hidden="true"
    >
      <BaseIcon name="sparkles" :size="14" />
    </span>
    <div class="min-w-0 flex-1 space-y-3">
      <div class="rounded-2xl rounded-tl-md bg-surface px-4 py-3.5">
        <div class="space-y-2">
          <BaseSkeleton height="0.75rem" width="88%" />
          <BaseSkeleton height="0.75rem" width="74%" />
          <BaseSkeleton height="0.75rem" width="45%" />
        </div>
      </div>
      <div class="flex items-center gap-2 px-1 text-xs text-ink-muted">
        <BaseSpinner :size="13" />
        {{ $t('AI.THINKING') }}
      </div>
    </div>
  </div>
</template>
