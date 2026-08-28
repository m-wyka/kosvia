<script setup lang="ts">
/** A working "Why?" panel, using the same components as the product page. */
/**
 * A worked example, rendered through the same reason translations the product
 * page uses — so the demo cannot drift out of sync with the real thing.
 */
const reasonLabel = useMatchReason();

const match = {
  score: 92,
  tier: 'perfect' as const,
  personalised: true,
  reasons: [
    { code: 'skin-type', label: '', impact: 8, params: { skinType: 'COMBINATION' as const } },
    { code: 'concerns', label: '', impact: 11, params: { concerns: ['dehydration', 'redness'] } },
    { code: 'fragrance-free', label: '', impact: 6 },
    { code: 'budget-fit', label: '', impact: 6 },
  ],
  warnings: [{ code: 'category-owned', label: '', impact: -3 }],
};
</script>

<template>
  <BaseCard class="shadow-md">
    <div class="flex items-center gap-4">
      <MatchScore :match="match" size="lg" :show-label="false" animate />
      <div>
        <p class="font-display text-xl text-ink">{{ $t('VOCAB.MATCH_TIER.PERFECT') }}</p>
        <p class="text-sm text-ink-muted">{{ $t('LANDING.MATCH.DEMO_PRODUCT') }}</p>
      </div>
    </div>

    <div class="mt-6 space-y-2">
      <p class="text-xs font-semibold tracking-wide text-ink-muted uppercase">
        {{ $t('LANDING.MATCH.DEMO_WHY') }}
      </p>
      <div
        v-for="reason in match.reasons"
        :key="reason.code"
        class="flex items-center gap-3"
      >
        <span class="min-w-0 flex-1 text-sm text-ink-soft">{{ reasonLabel(reason) }}</span>
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
        <span class="min-w-0 flex-1 text-sm text-ink-soft">{{ reasonLabel(warning) }}</span>
        <span class="h-1.5 w-16 overflow-hidden rounded-pill bg-line">
          <span class="block h-full rounded-pill bg-caution" :style="{ width: `${Math.abs(warning.impact) * 8}%` }" />
        </span>
        <span class="w-8 text-right text-xs tabular-nums text-caution">{{ warning.impact }}</span>
      </div>
    </div>
  </BaseCard>
</template>
