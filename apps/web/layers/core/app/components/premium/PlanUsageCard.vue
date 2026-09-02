<script setup lang="ts">
import type { EntitlementUsageDto } from '@kosvia/shared';

const { isAuthenticated } = storeToRefs(useAuthStore());
const { overview, fetchOverview } = useSubscription();
const { t } = useI18n();

const metrics = computed(() => {
  const entitlements = overview.value?.entitlements;
  if (!entitlements) {
    return [];
  }
  return [
    { key: 'AI', label: t('PRICING.USAGE.AI'), usage: entitlements.aiMessages },
    {
      key: 'PERSONAL_MATCH',
      label: t('PRICING.USAGE.PERSONAL_MATCH'),
      usage: entitlements.personalMatch,
    },
    {
      key: 'PRICE_ALERTS',
      label: t('PRICING.USAGE.PRICE_ALERTS'),
      usage: entitlements.priceAlerts,
    },
    { key: 'SHELF', label: t('PRICING.USAGE.SHELF'), usage: entitlements.shelfItems },
  ];
});

const usageLabel = (usage: EntitlementUsageDto): string => {
  if (usage.limit === null) {
    return t('PRICING.UNLIMITED');
  }
  return `${usage.used} / ${usage.limit}`;
};

onMounted(() => {
  void fetchOverview();
});
</script>

<template>
  <div v-if="isAuthenticated && overview" class="rounded-xl border border-line bg-surface p-6">
    <h2 class="font-display text-lg text-ink">
      {{ $t('PRICING.USAGE.TITLE') }}
    </h2>
    <dl class="mt-4 grid gap-4 sm:grid-cols-2">
      <div v-for="metric in metrics" :key="metric.key">
        <dt class="text-xs text-ink-muted">
          {{ metric.label }}
        </dt>
        <dd class="mt-0.5 text-sm font-medium text-ink">
          {{ usageLabel(metric.usage) }}
        </dd>
      </div>
    </dl>
  </div>
</template>
