<script setup lang="ts">
/** A working "Why?" panel, using the same components as the product page. */
const match = {
  score: 92,
  tier: 'perfect' as const,
  personalised: true,
  reasons: [
    { code: 'skin-type', label: 'Formulated for combination skin', impact: 8 },
    { code: 'concerns', label: 'Targets dehydration and redness', impact: 11 },
    { code: 'fragrance-free', label: 'Fragrance-free, which you prefer', impact: 6 },
    { code: 'budget-fit', label: 'Fits your budget', impact: 6 },
  ],
  warnings: [{ code: 'category-owned', label: 'You already have a moisturiser', impact: -3 }],
};
</script>

<template>
  <BaseCard class="shadow-md">
    <div class="flex items-center gap-4">
      <MatchScore :match="match" size="lg" :show-label="false" animate />
      <div>
        <p class="font-display text-xl text-ink">Perfect match</p>
        <p class="text-sm text-ink-muted">Kalmé Ceramide Barrier Cream</p>
      </div>
    </div>

    <div class="mt-6 space-y-2">
      <p class="text-xs font-semibold tracking-wide text-ink-muted uppercase">Why this score</p>
      <div
        v-for="reason in match.reasons"
        :key="reason.code"
        class="flex items-center gap-3"
      >
        <span class="min-w-0 flex-1 text-sm text-ink-soft">{{ reason.label }}</span>
        <span class="h-1.5 w-16 overflow-hidden rounded-pill bg-line">
          <span class="block h-full rounded-pill bg-sage" :style="{ width: `${reason.impact * 8}%` }" />
        </span>
        <span class="w-8 text-right text-xs tabular-nums text-sage">+{{ reason.impact }}</span>
      </div>

      <div
        v-for="warning in match.warnings"
        :key="warning.code"
        class="flex items-center gap-3 border-t border-line pt-2"
      >
        <span class="min-w-0 flex-1 text-sm text-ink-soft">{{ warning.label }}</span>
        <span class="h-1.5 w-16 overflow-hidden rounded-pill bg-line">
          <span class="block h-full rounded-pill bg-caution" :style="{ width: `${Math.abs(warning.impact) * 8}%` }" />
        </span>
        <span class="w-8 text-right text-xs tabular-nums text-caution">{{ warning.impact }}</span>
      </div>
    </div>
  </BaseCard>
</template>
