<script setup lang="ts">
const { t } = useI18n();
const { isAuthenticated } = storeToRefs(useAuthStore());
const { overview, fetchOverview } = useSubscription();

const comparisonOpen = ref(false);

onMounted(() => {
  if (isAuthenticated.value) {
    void fetchOverview();
  }
});

useSeo(() => ({
  title: t('SEO.PRICING.TITLE'),
  description: t('SEO.PRICING.DESCRIPTION'),
  path: '/pricing',
}));
</script>

<template>
  <div class="container-page py-12 sm:py-16">
    <SectionHeading
      :eyebrow="$t('PRICING.EYEBROW')"
      :title="$t('PRICING.TITLE')"
      :description="$t('PRICING.BODY')"
      align="center"
    />

    <PricingPlanCards class="mt-10" />

    <div class="mt-8 flex justify-center">
      <BaseButton variant="ghost" @click="comparisonOpen = true">
        {{ $t('PRICING.COMPARE.OPEN') }}
      </BaseButton>
    </div>

    <div
      v-if="isAuthenticated && overview"
      class="mx-auto mt-10 max-w-3xl rounded-xl border border-line bg-surface p-6"
    >
      <h2 class="font-display text-lg text-ink">
        {{ $t('PRICING.USAGE.TITLE') }}
      </h2>
      <dl class="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <dt class="text-xs text-ink-muted">
            {{ $t('PRICING.USAGE.AI') }}
          </dt>
          <dd class="mt-0.5 text-sm font-medium text-ink">
            {{
              overview.entitlements.aiMessages.limit === null
                ? $t('PRICING.UNLIMITED')
                : `${overview.entitlements.aiMessages.used} / ${overview.entitlements.aiMessages.limit}`
            }}
          </dd>
        </div>
        <div>
          <dt class="text-xs text-ink-muted">
            {{ $t('PRICING.USAGE.PERSONAL_MATCH') }}
          </dt>
          <dd class="mt-0.5 text-sm font-medium text-ink">
            {{
              overview.entitlements.personalMatch.limit === null
                ? $t('PRICING.UNLIMITED')
                : `${overview.entitlements.personalMatch.used} / ${overview.entitlements.personalMatch.limit}`
            }}
          </dd>
        </div>
        <div>
          <dt class="text-xs text-ink-muted">
            {{ $t('PRICING.USAGE.PRICE_ALERTS') }}
          </dt>
          <dd class="mt-0.5 text-sm font-medium text-ink">
            {{ overview.entitlements.priceAlerts.used }} /
            {{ overview.entitlements.priceAlerts.limit }}
          </dd>
        </div>
        <div>
          <dt class="text-xs text-ink-muted">
            {{ $t('PRICING.USAGE.SHELF') }}
          </dt>
          <dd class="mt-0.5 text-sm font-medium text-ink">
            {{
              overview.entitlements.shelfItems.limit === null
                ? $t('PRICING.UNLIMITED')
                : `${overview.entitlements.shelfItems.used} / ${overview.entitlements.shelfItems.limit}`
            }}
          </dd>
        </div>
      </dl>
    </div>

    <PricingComparisonModal v-model:open="comparisonOpen" />
  </div>
</template>
