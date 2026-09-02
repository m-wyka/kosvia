<script setup lang="ts">
import type { SubscriptionPeriod, SubscriptionPlanDto } from '@kosvia/shared';

definePageMeta({ layout: 'admin', middleware: 'admin' });

interface PlanForm {
  price: number | null;
  currency: string;
  isActive: boolean;
}

const api = useApi();
const toast = useToast();
const message = useApiMessage();
const { t } = useI18n();
const format = useFormat();

const { data, pending, error, refresh } = await useApiFetch<SubscriptionPlanDto[]>(
  '/admin/subscription-plans',
  { key: 'admin-subscription-plans' },
);

const saving = ref<SubscriptionPeriod | null>(null);
const forms = reactive<Record<SubscriptionPeriod, PlanForm>>({
  MONTHLY: { price: null, currency: 'PLN', isActive: true },
  YEARLY: { price: null, currency: 'PLN', isActive: true },
});

watch(
  data,
  (plans) => {
    for (const plan of plans ?? []) {
      forms[plan.period] = {
        price: minorToMajor(plan.priceMinor),
        currency: plan.currency,
        isActive: plan.isActive,
      };
    }
  },
  { immediate: true },
);

const monthlyMinor = computed(() => Math.round((forms.MONTHLY.price ?? 0) * 100));
const yearlyMinor = computed(() => Math.round((forms.YEARLY.price ?? 0) * 100));
const savingsLabel = computed(() => {
  const savedMinor = yearlySavingsMinor(monthlyMinor.value, yearlyMinor.value);
  if (savedMinor <= 0) {
    return null;
  }
  return t('ADMIN.SUBSCRIPTIONS.SAVINGS_PREVIEW', {
    amount: format.price(minorToMajor(savedMinor), forms.YEARLY.currency),
    percent: yearlySavingsPercent(monthlyMinor.value, yearlyMinor.value),
  });
});

const periodLabel = (period: SubscriptionPeriod): string =>
  period === 'MONTHLY' ? t('ADMIN.SUBSCRIPTIONS.MONTHLY') : t('ADMIN.SUBSCRIPTIONS.YEARLY');

const save = async (period: SubscriptionPeriod) => {
  const form = forms[period];
  if (form.price === null || form.price < 0) {
    toast.error(t('ADMIN.SUBSCRIPTIONS.INVALID_PRICE'));
    return;
  }
  saving.value = period;
  try {
    await api(`/admin/subscription-plans/${period.toLowerCase()}`, {
      method: 'PATCH',
      body: {
        priceMinor: Math.round(form.price * 100),
        currency: form.currency,
        isActive: form.isActive,
      },
    });
    await refresh();
    toast.success(t('ADMIN.SUBSCRIPTIONS.SAVED', { period: periodLabel(period) }));
  } catch (caught) {
    toast.error(message(caught));
  } finally {
    saving.value = null;
  }
};

useSeo(() => ({
  title: t('SEO.ADMIN.SUBSCRIPTIONS'),
  description: t('SEO.ADMIN.SUBSCRIPTIONS_DESCRIPTION'),
  noindex: true,
}));
</script>

<template>
  <div>
    <AdminPageHeader
      :title="$t('ADMIN.SUBSCRIPTIONS.TITLE')"
      :description="$t('ADMIN.SUBSCRIPTIONS.SUBTITLE')"
    />

    <BaseErrorState v-if="error" @retry="refresh()" />

    <div v-else-if="pending" class="grid gap-6 lg:grid-cols-2">
      <BaseSkeleton v-for="index in 2" :key="index" height="16rem" rounded="var(--radius-xl)" />
    </div>

    <template v-else>
      <div class="grid gap-6 lg:grid-cols-2">
        <BaseCard v-for="period in ['MONTHLY', 'YEARLY'] as const" :key="period">
          <h2 class="font-display text-lg text-ink">
            {{ periodLabel(period) }}
          </h2>
          <div class="mt-4 space-y-4">
            <BaseInput
              v-model="forms[period].price"
              type="number"
              inputmode="decimal"
              :label="$t('ADMIN.SUBSCRIPTIONS.PRICE_LABEL')"
              :hint="$t('ADMIN.SUBSCRIPTIONS.PRICE_HINT')"
            />
            <BaseInput
              v-model="forms[period].currency"
              :label="$t('ADMIN.SUBSCRIPTIONS.CURRENCY_LABEL')"
            />
            <BaseSwitch
              v-model="forms[period].isActive"
              :label="$t('ADMIN.SUBSCRIPTIONS.ACTIVE_LABEL')"
              :hint="$t('ADMIN.SUBSCRIPTIONS.ACTIVE_HINT')"
            />
            <BaseButton :loading="saving === period" @click="save(period)">
              {{ $t('ADMIN.SUBSCRIPTIONS.SAVE') }}
            </BaseButton>
          </div>
        </BaseCard>
      </div>

      <BaseCard class="mt-6">
        <h2 class="text-sm font-semibold text-ink">
          {{ $t('ADMIN.SUBSCRIPTIONS.PREVIEW_TITLE') }}
        </h2>
        <p class="mt-2 text-sm text-ink-soft">
          {{ savingsLabel ?? $t('ADMIN.SUBSCRIPTIONS.NO_SAVINGS') }}
        </p>
        <p class="mt-3 text-xs leading-relaxed text-ink-muted">
          {{ $t('ADMIN.SUBSCRIPTIONS.PROVIDER_NOTE') }}
        </p>
      </BaseCard>
    </template>
  </div>
</template>
