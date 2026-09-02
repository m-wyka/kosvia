<script setup lang="ts">
import type { SubscriptionPeriod } from '@kosvia/shared';

const model = defineModel<SubscriptionPeriod>({ required: true });
defineProps<{ savingsPercent: number }>();

const isYearly = computed(() => model.value === 'YEARLY');

const togglePeriod = () => {
  model.value = isYearly.value ? 'MONTHLY' : 'YEARLY';
};

const selectMonthly = () => {
  model.value = 'MONTHLY';
};

const selectYearly = () => {
  model.value = 'YEARLY';
};
</script>

<template>
  <div
    class="inline-flex items-center gap-3 rounded-xl border border-line bg-surface px-5 py-3 shadow-xs"
  >
    <button
      type="button"
      class="text-base font-semibold transition-colors duration-base"
      :class="isYearly ? 'text-ink-muted' : 'text-ink'"
      @click="selectMonthly"
    >
      {{ $t('PRICING.BILLING.MONTHLY') }}
    </button>
    <button
      type="button"
      role="switch"
      class="flex h-7 w-13 shrink-0 items-center rounded-pill border border-line-strong bg-canvas-deep px-0.5 transition-colors duration-base"
      :aria-checked="isYearly ? 'true' : 'false'"
      :aria-label="$t('PRICING.BILLING.TOGGLE')"
      @click="togglePeriod"
    >
      <span
        class="size-5.5 rounded-full bg-white shadow-sm transition-transform duration-base ease-out-soft"
        :class="isYearly ? 'translate-x-6' : 'translate-x-0'"
      />
    </button>
    <button
      type="button"
      class="flex items-center gap-2 text-base font-semibold transition-colors duration-base"
      :class="isYearly ? 'text-ink' : 'text-ink-muted'"
      @click="selectYearly"
    >
      {{ $t('PRICING.BILLING.YEARLY') }}
      <BaseBadge v-if="savingsPercent > 0" tone="positive">-{{ savingsPercent }}%</BaseBadge>
    </button>
  </div>
</template>
