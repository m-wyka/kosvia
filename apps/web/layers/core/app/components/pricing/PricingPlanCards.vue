<script setup lang="ts">
import type { SubscriptionPeriod, SubscriptionPlanDto } from '@kosvia/shared';

const FREE_FEATURE_COUNT = 4;
const PREMIUM_FEATURE_COUNT = 5;

const { t } = useI18n();
const { price } = useFormat();
const { isAuthenticated, isPremium } = storeToRefs(useAuthStore());

const { data: plans, pending } = await useApiFetch<SubscriptionPlanDto[]>('/subscription/plans', {
  key: 'subscription-plans',
});

const selectedPeriod = ref<SubscriptionPeriod>('MONTHLY');
const upgradeOpen = ref(false);

const monthlyPlan = computed(() => planByPeriod(plans.value, 'MONTHLY'));
const yearlyPlan = computed(() => planByPeriod(plans.value, 'YEARLY'));
const hasYearlyChoice = computed(
  () => Boolean(monthlyPlan.value?.isActive) && Boolean(yearlyPlan.value?.isActive),
);
const selectedPlan = computed(() =>
  selectedPeriod.value === 'YEARLY' ? yearlyPlan.value : monthlyPlan.value,
);

const savingsPercent = computed(() => {
  if (!monthlyPlan.value || !yearlyPlan.value) {
    return 0;
  }
  return yearlySavingsPercent(monthlyPlan.value.priceMinor, yearlyPlan.value.priceMinor);
});

const savingsLabel = computed(() => {
  if (!monthlyPlan.value || !yearlyPlan.value) {
    return null;
  }
  const savedMinor = yearlySavingsMinor(monthlyPlan.value.priceMinor, yearlyPlan.value.priceMinor);
  if (savedMinor <= 0) {
    return null;
  }
  return t('PRICING.PREMIUM.YEARLY_SAVINGS', {
    amount: price(minorToMajor(savedMinor), yearlyPlan.value.currency),
  });
});

const premiumPriceLabel = computed(() => {
  const plan = selectedPlan.value;
  if (!plan) {
    return null;
  }
  return price(minorToMajor(plan.priceMinor), plan.currency);
});

const premiumCadenceLabel = computed(() =>
  selectedPeriod.value === 'YEARLY' ? t('PRICING.PER_YEAR') : t('PRICING.PER_MONTH'),
);

const yearlyEquivalentLabel = computed(() => {
  if (selectedPeriod.value !== 'YEARLY' || !yearlyPlan.value) {
    return null;
  }
  return t('PRICING.PREMIUM.MONTHLY_EQUIVALENT', {
    amount: price(
      minorToMajor(yearlyMonthlyEquivalentMinor(yearlyPlan.value.priceMinor)),
      yearlyPlan.value.currency,
    ),
  });
});

const freeFeatures = computed(() =>
  Array.from({ length: FREE_FEATURE_COUNT }, (_, index) => t(`PRICING.FREE.F_${index + 1}`)),
);
const premiumFeatures = computed(() =>
  Array.from({ length: PREMIUM_FEATURE_COUNT }, (_, index) => t(`PRICING.PREMIUM.F_${index + 1}`)),
);

const handlePremiumClick = () => {
  upgradeOpen.value = true;
};
</script>

<template>
  <div>
    <div v-if="hasYearlyChoice" class="flex justify-center">
      <PricingBillingToggle v-model="selectedPeriod" :savings-percent="savingsPercent" />
    </div>

    <div class="mx-auto mt-10 grid max-w-3xl gap-5 sm:grid-cols-2">
      <div class="relative flex flex-col rounded-xl border border-line bg-surface p-6">
        <h3 class="font-display text-xl text-ink">
          {{ $t('PRICING.FREE.NAME') }}
        </h3>
        <p class="mt-1 text-sm text-ink-muted">
          {{ $t('PRICING.FREE.DESCRIPTION') }}
        </p>

        <p class="mt-5 flex items-baseline gap-1.5">
          <span class="font-display text-3xl text-ink">
            {{ $t('PRICING.FREE.PRICE') }}
          </span>
          <span class="text-sm text-ink-muted">
            {{ $t('PRICING.FOREVER') }}
          </span>
        </p>

        <ul class="mt-5 flex-1 space-y-2.5">
          <li
            v-for="feature in freeFeatures"
            :key="feature"
            class="flex items-start gap-2.5 text-sm text-ink-soft"
          >
            <BaseIcon name="check" :size="15" class="mt-0.5 shrink-0 text-sage" />
            {{ feature }}
          </li>
        </ul>

        <BaseBadge v-if="isAuthenticated && !isPremium" tone="sage" class="mt-6 self-start">
          {{ $t('PRICING.CURRENT_PLAN') }}
        </BaseBadge>
        <BaseButton
          v-else-if="!isAuthenticated"
          to="/register"
          variant="secondary"
          block
          class="mt-6"
        >
          {{ $t('PRICING.FREE.CTA') }}
        </BaseButton>
      </div>

      <div class="relative flex flex-col rounded-xl border border-ink bg-surface p-6 shadow-md">
        <BaseBadge tone="blush" class="absolute -top-2.5 left-6">
          {{ $t('PRICING.PREMIUM.BADGE') }}
        </BaseBadge>

        <h3 class="font-display text-xl text-ink">
          {{ $t('PRICING.PREMIUM.NAME') }}
        </h3>
        <p class="mt-1 text-sm text-ink-muted">
          {{ $t('PRICING.PREMIUM.DESCRIPTION') }}
        </p>

        <BaseSkeleton v-if="pending" height="2.5rem" class="mt-5" />
        <p v-else class="mt-5 flex items-baseline gap-1.5">
          <span class="font-display text-3xl text-ink">{{ premiumPriceLabel }}</span>
          <span class="text-sm text-ink-muted">{{ premiumCadenceLabel }}</span>
        </p>
        <p v-if="yearlyEquivalentLabel" class="mt-1 text-xs text-ink-muted">
          {{ yearlyEquivalentLabel }}
        </p>
        <p v-if="selectedPeriod === 'YEARLY' && savingsLabel" class="mt-1 text-xs text-positive">
          {{ savingsLabel }}
        </p>

        <ul class="mt-5 flex-1 space-y-2.5">
          <li
            v-for="feature in premiumFeatures"
            :key="feature"
            class="flex items-start gap-2.5 text-sm text-ink-soft"
          >
            <BaseIcon name="sparkles" :size="15" class="mt-0.5 shrink-0 text-blush" />
            {{ feature }}
          </li>
        </ul>

        <BaseBadge v-if="isPremium" tone="blush" class="mt-6 self-start">
          {{ $t('PRICING.CURRENT_PLAN') }}
        </BaseBadge>
        <BaseButton v-else block class="mt-6" @click="handlePremiumClick">
          {{ $t('PRICING.PREMIUM.CTA') }}
        </BaseButton>
      </div>
    </div>

    <BaseModal v-model:open="upgradeOpen" :title="$t('PRICING.UPGRADE.TITLE')" size="sm">
      <p class="text-sm text-ink-soft">
        {{ $t('PRICING.UPGRADE.BODY') }}
      </p>
      <template #footer>
        <BaseButton variant="ghost" @click="upgradeOpen = false">
          {{ $t('COMMON.CLOSE') }}
        </BaseButton>
        <BaseButton v-if="!isAuthenticated" to="/register">
          {{ $t('PRICING.UPGRADE.CREATE_ACCOUNT') }}
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
