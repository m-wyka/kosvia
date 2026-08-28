<script setup lang="ts">
import { formatPrice, type PriceAlertDto } from '@kosvia/shared';

definePageMeta({ middleware: 'auth' });

const api = useApi();
const toast = useToast();
const message = useApiMessage();

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
    toast.notify('Alert removed');
  } catch (caught) {
    toast.error(message(caught));
  }
}

function distance(alert: PriceAlertDto): string {
  if (alert.product.lowestPrice === null) return 'No price on record';
  const gap = alert.product.lowestPrice - alert.targetPrice;
  if (gap <= 0) return `Already ${formatPrice(Math.abs(gap))} below your target`;
  return `${formatPrice(gap)} above your target`;
}

useSeo({ title: 'Price alerts', description: 'Products you are watching for a price drop.', noindex: true });
</script>

<template>
  <div class="container-page max-w-4xl py-8 sm:py-12">
    <header class="mb-8">
      <h1 class="font-display text-3xl text-ink sm:text-4xl">Price alerts</h1>
      <p class="mt-2 text-sm text-ink-muted">
        Set a number, and we will tell you when a product reaches it.
      </p>
    </header>

    <BaseErrorState v-if="error" @retry="refresh()" />

    <div v-else-if="pending" class="space-y-3">
      <BaseSkeleton v-for="index in 3" :key="index" height="5.5rem" rounded="var(--radius-xl)" />
    </div>

    <BaseEmptyState
      v-else-if="!alerts?.length"
      icon="bell"
      title="No alerts yet"
      description="Open any product and use “Price alert” to start watching it."
    >
      <BaseButton to="/products">Browse products</BaseButton>
    </BaseEmptyState>

    <template v-else>
      <section v-if="triggered.length" class="mb-10">
        <h2 class="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
          <BaseIcon name="check" :size="16" class="text-positive" />
          At or below your target
        </h2>
        <ul class="space-y-3">
          <li v-for="alert in triggered" :key="alert.id">
            <div class="flex flex-wrap items-center gap-4 rounded-xl border border-positive/30 bg-positive-soft/40 p-4">
              <NuxtLink :to="`/products/${alert.product.slug}`" class="w-16 shrink-0">
                <ProductImage :src="alert.product.imageUrl" :alt="alert.product.name" ratio="square" class="rounded-md" />
              </NuxtLink>
              <div class="min-w-0 flex-1">
                <p class="truncate text-2xs tracking-wide text-ink-muted uppercase">{{ alert.product.brand.name }}</p>
                <NuxtLink :to="`/products/${alert.product.slug}`" class="text-sm font-medium text-ink hover:underline">
                  {{ alert.product.name }}
                </NuxtLink>
                <p class="mt-0.5 text-xs text-positive">{{ distance(alert) }}</p>
              </div>
              <div class="text-right">
                <p class="text-lg font-semibold tabular-nums text-ink">
                  {{ formatPrice(alert.product.lowestPrice) }}
                </p>
                <p class="text-xs text-ink-muted">target {{ formatPrice(alert.targetPrice) }}</p>
              </div>
              <BaseButton :to="`/products/${alert.product.slug}`" size="sm">View</BaseButton>
            </div>
          </li>
        </ul>
      </section>

      <section v-if="watching.length">
        <h2 class="mb-3 text-sm font-semibold text-ink">Watching</h2>
        <ul class="space-y-3">
          <li
            v-for="alert in watching"
            :key="alert.id"
            class="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface p-4"
            :class="!alert.active && 'opacity-60'"
          >
            <NuxtLink :to="`/products/${alert.product.slug}`" class="w-16 shrink-0">
              <ProductImage :src="alert.product.imageUrl" :alt="alert.product.name" ratio="square" class="rounded-md" />
            </NuxtLink>
            <div class="min-w-0 flex-1">
              <p class="truncate text-2xs tracking-wide text-ink-muted uppercase">{{ alert.product.brand.name }}</p>
              <NuxtLink :to="`/products/${alert.product.slug}`" class="text-sm font-medium text-ink hover:underline">
                {{ alert.product.name }}
              </NuxtLink>
              <p class="mt-0.5 text-xs text-ink-muted">{{ distance(alert) }}</p>
            </div>
            <div class="text-right">
              <p class="text-lg font-semibold tabular-nums text-ink">
                {{ formatPrice(alert.product.lowestPrice) }}
              </p>
              <p class="text-xs text-ink-muted">target {{ formatPrice(alert.targetPrice) }}</p>
            </div>
            <div class="flex items-center gap-1">
              <BaseButton variant="ghost" size="sm" @click="toggleActive(alert)">
                {{ alert.active ? 'Pause' : 'Resume' }}
              </BaseButton>
              <button
                type="button"
                class="rounded-md p-2 text-ink-faint transition-colors hover:text-critical"
                :aria-label="`Delete alert for ${alert.product.name}`"
                @click="remove(alert)"
              >
                <BaseIcon name="trash" :size="16" />
              </button>
            </div>
          </li>
        </ul>
      </section>

      <p class="mt-8 rounded-lg bg-surface-muted px-4 py-3 text-xs leading-relaxed text-ink-muted">
        Alerts are evaluated against the store offers we hold when you open this page. Background
        price watching and push notifications are planned, not built.
      </p>
    </template>
  </div>
</template>
