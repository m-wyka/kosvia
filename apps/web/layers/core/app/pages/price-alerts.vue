<script setup lang="ts">
import type { PriceAlertDto } from '@kosvia/shared';

definePageMeta({ middleware: 'auth' });

const api = useApi();
const toast = useToast();
const message = useApiMessage();
const { t } = useI18n();
const format = useFormat();

const { data: alerts, pending, error, refresh } = await useApiFetch<PriceAlertDto[]>('/price-alerts', {
  key: 'price-alerts',
  default: () => [],
});

const triggered = computed(() => (alerts.value ?? []).filter((alert) => alert.triggered));
const watching = computed(() => (alerts.value ?? []).filter((alert) => !alert.triggered));

async function toggleActive(alert: PriceAlertDto) {
  try {
    await api(`/price-alerts/${alert.id}`, { method: 'PATCH', body: { active: !alert.active } });
    await refresh();
  } catch (caught) {
    toast.error(message(caught));
  }
}

async function remove(alert: PriceAlertDto) {
  try {
    await api(`/price-alerts/${alert.id}`, { method: 'DELETE' });
    await refresh();
    toast.notify(t('ALERTS.REMOVED'));
  } catch (caught) {
    toast.error(message(caught));
  }
}

function distance(alert: PriceAlertDto): string {
  if (alert.product.lowestPrice === null) return t('ALERTS.NO_PRICE');
  const gap = alert.product.lowestPrice - alert.targetPrice;
  return gap <= 0
    ? t('ALERTS.BELOW', { amount: format.price(Math.abs(gap)) })
    : t('ALERTS.ABOVE', { amount: format.price(gap) });
}

useSeo(() => ({
  title: t('SEO.ALERTS.TITLE'),
  description: t('SEO.ALERTS.DESCRIPTION'),
  noindex: true,
}));
</script>

<template>
  <div class="container-page max-w-4xl py-8 sm:py-12">
    <header class="mb-8">
      <h1 class="font-display text-3xl text-ink sm:text-4xl">{{ $t('ALERTS.TITLE') }}</h1>
      <p class="mt-2 text-sm text-ink-muted">{{ $t('ALERTS.SUBTITLE') }}</p>
    </header>

    <BaseErrorState v-if="error" @retry="refresh()" />

    <div v-else-if="pending" class="space-y-3">
      <BaseSkeleton v-for="index in 3" :key="index" height="5.5rem" rounded="var(--radius-xl)" />
    </div>

    <BaseEmptyState
      v-else-if="!alerts?.length"
      icon="bell"
      :title="$t('ALERTS.EMPTY_TITLE')"
      :description="$t('ALERTS.EMPTY_BODY')"
    >
      <BaseButton to="/products">{{ $t('ALERTS.BROWSE') }}</BaseButton>
    </BaseEmptyState>

    <template v-else>
      <section v-if="triggered.length" class="mb-10">
        <h2 class="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
          <BaseIcon name="check" :size="16" class="text-positive" />
          {{ $t('ALERTS.TRIGGERED_TITLE') }}
        </h2>
        <ul class="space-y-3">
          <li v-for="alert in triggered" :key="alert.id">
            <div class="flex flex-wrap items-center gap-4 rounded-xl border border-positive/30 bg-positive-soft/40 p-4">
              <NuxtLinkLocale :to="`/products/${alert.product.slug}`" class="w-16 shrink-0">
                <ProductImage :src="alert.product.imageUrl" :alt="alert.product.name" ratio="square" class="rounded-md" />
              </NuxtLinkLocale>
              <div class="min-w-0 flex-1">
                <p class="truncate text-2xs tracking-wide text-ink-muted uppercase">{{ alert.product.brand.name }}</p>
                <NuxtLinkLocale :to="`/products/${alert.product.slug}`" class="text-sm font-medium text-ink hover:underline">
                  {{ alert.product.name }}
                </NuxtLinkLocale>
                <p class="mt-0.5 text-xs text-positive">{{ distance(alert) }}</p>
              </div>
              <div class="text-right">
                <p class="text-lg font-semibold tabular-nums text-ink">
                  {{ format.price(alert.product.lowestPrice) }}
                </p>
                <p class="text-xs text-ink-muted">
                  {{ $t('ALERTS.TARGET', { price: format.price(alert.targetPrice) }) }}
                </p>
              </div>
              <BaseButton :to="`/products/${alert.product.slug}`" size="sm">
                {{ $t('ALERTS.VIEW') }}
              </BaseButton>
            </div>
          </li>
        </ul>
      </section>

      <section v-if="watching.length">
        <h2 class="mb-3 text-sm font-semibold text-ink">{{ $t('ALERTS.WATCHING_TITLE') }}</h2>
        <ul class="space-y-3">
          <li
            v-for="alert in watching"
            :key="alert.id"
            class="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface p-4"
            :class="!alert.active && 'opacity-60'"
          >
            <NuxtLinkLocale :to="`/products/${alert.product.slug}`" class="w-16 shrink-0">
              <ProductImage :src="alert.product.imageUrl" :alt="alert.product.name" ratio="square" class="rounded-md" />
            </NuxtLinkLocale>
            <div class="min-w-0 flex-1">
              <p class="truncate text-2xs tracking-wide text-ink-muted uppercase">{{ alert.product.brand.name }}</p>
              <NuxtLinkLocale :to="`/products/${alert.product.slug}`" class="text-sm font-medium text-ink hover:underline">
                {{ alert.product.name }}
              </NuxtLinkLocale>
              <p class="mt-0.5 text-xs text-ink-muted">{{ distance(alert) }}</p>
            </div>
            <div class="text-right">
              <p class="text-lg font-semibold tabular-nums text-ink">
                {{ format.price(alert.product.lowestPrice) }}
              </p>
              <p class="text-xs text-ink-muted">
                {{ $t('ALERTS.TARGET', { price: format.price(alert.targetPrice) }) }}
              </p>
            </div>
            <div class="flex items-center gap-1">
              <BaseButton variant="ghost" size="sm" @click="toggleActive(alert)">
                {{ alert.active ? $t('ALERTS.PAUSE') : $t('ALERTS.RESUME') }}
              </BaseButton>
              <button
                type="button"
                class="rounded-md p-2 text-ink-faint transition-colors hover:text-critical"
                :aria-label="$t('ALERTS.DELETE', { name: alert.product.name })"
                @click="remove(alert)"
              >
                <BaseIcon name="trash" :size="16" />
              </button>
            </div>
          </li>
        </ul>
      </section>

      <p class="mt-8 rounded-lg bg-surface-muted px-4 py-3 text-xs leading-relaxed text-ink-muted">
        {{ $t('ALERTS.NOTE') }}
      </p>
    </template>
  </div>
</template>
