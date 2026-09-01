<script setup lang="ts">
import type { DashboardDto, RegulatoryChangeKind } from '@kosvia/shared';

definePageMeta({ middleware: 'auth' });

const MAX_OBSERVATIONS = 3;

const { displayName } = storeToRefs(useAuthStore());
const { t } = useI18n();
const localise = useLocalisedText();
const api = useApi();
const toast = useToast();
const message = useApiMessage();

const { data, pending, error, refresh } = await useApiFetch<DashboardDto>('/dashboard', {
  key: 'dashboard',
});

const regulatoryAlerts = computed(() => data.value?.regulatoryAlerts ?? []);

const regulatoryKindLabel = (kind: RegulatoryChangeKind): string => {
  return kind === 'became-prohibited'
    ? t('DASHBOARD.REGULATORY.BECAME_PROHIBITED')
    : t('DASHBOARD.REGULATORY.BECAME_RESTRICTED');
};

const dismissRegulatoryAlerts = async () => {
  try {
    await api('/shelf/regulatory-alerts/seen', { method: 'POST' });
    await refresh();
  } catch (caught) {
    toast.error(message(caught));
  }
};

const stats = computed(() => [
  {
    label: t('DASHBOARD.STAT_SHELF'),
    value: data.value?.shelfCount ?? 0,
    to: '/shelf',
    icon: 'shelf' as const,
  },
  {
    label: t('DASHBOARD.STAT_FAVORITES'),
    value: data.value?.favoriteCount ?? 0,
    to: '/shelf?tab=favorites',
    icon: 'heart' as const,
  },
  {
    label: t('DASHBOARD.STAT_ALERTS'),
    value: data.value?.activeAlerts ?? 0,
    to: '/price-alerts',
    icon: 'bell' as const,
  },
]);

const observations = computed(
  () => data.value?.routine?.observations.slice(0, MAX_OBSERVATIONS) ?? [],
);

useSeo(() => ({
  title: t('SEO.DASHBOARD.TITLE'),
  description: t('SEO.DASHBOARD.DESCRIPTION'),
  noindex: true,
}));
</script>

<template>
  <div class="container-page py-8 sm:py-12">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="font-display text-3xl text-ink sm:text-4xl">
          {{ $t('DASHBOARD.GREETING', { name: displayName }) }}
        </h1>
        <p class="mt-2 text-sm text-ink-muted">
          {{ data?.profile ? $t('DASHBOARD.SUBTITLE_PERSONAL') : $t('DASHBOARD.SUBTITLE_GENERIC') }}
        </p>
      </div>
      <span class="flex flex-wrap gap-2">
        <BaseButton to="/diary" variant="secondary">
          <template #icon><BaseIcon name="edit" :size="16" /></template>
          {{ $t('DASHBOARD.OPEN_DIARY') }}
        </BaseButton>
        <BaseButton to="/ai" variant="secondary">
          <template #icon><BaseIcon name="sparkles" :size="16" /></template>
          {{ $t('DASHBOARD.ASK_AI') }}
        </BaseButton>
      </span>
    </header>

    <BaseErrorState v-if="error" class="mt-8" @retry="refresh()" />

    <template v-else>
      <div v-if="!pending && !data?.profile" class="mt-8">
        <BaseCard
          class="flex flex-wrap items-center justify-between gap-4 border-blush/30 bg-blush-soft"
        >
          <div class="min-w-0">
            <h2 class="font-display text-lg text-ink">{{ $t('DASHBOARD.NO_PROFILE_TITLE') }}</h2>
            <p class="mt-1 text-sm text-ink-soft">{{ $t('DASHBOARD.NO_PROFILE_BODY') }}</p>
          </div>
          <BaseButton to="/onboarding">{{ $t('DASHBOARD.NO_PROFILE_CTA') }}</BaseButton>
        </BaseCard>
      </div>

      <div v-if="regulatoryAlerts.length" class="mt-8">
        <BaseCard class="border-caution/40 bg-caution-soft">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="min-w-0">
              <h2 class="flex items-center gap-2 font-display text-lg text-ink">
                <BaseIcon name="alert" :size="18" class="text-caution" />
                {{ $t('DASHBOARD.REGULATORY.TITLE') }}
              </h2>
              <ul class="mt-3 space-y-3">
                <li
                  v-for="alert in regulatoryAlerts"
                  :key="alert.ingredientId"
                  class="text-sm text-ink-soft"
                >
                  <p>
                    <NuxtLinkLocale
                      :to="`/ingredients/${alert.slug}`"
                      class="font-medium text-ink underline-offset-4 hover:underline"
                    >
                      {{ alert.inciName }}
                    </NuxtLinkLocale>
                    {{ regulatoryKindLabel(alert.kind) }}
                  </p>
                  <p class="mt-1 text-xs text-ink-muted">
                    {{ $t('DASHBOARD.REGULATORY.AFFECTED_PRODUCTS') }}
                    <template v-for="(product, index) in alert.products" :key="product.id">
                      <template v-if="index > 0">,</template>
                      <NuxtLinkLocale
                        :to="`/products/${product.slug}`"
                        class="underline-offset-4 hover:underline"
                      >
                        {{ product.name }}
                      </NuxtLinkLocale>
                    </template>
                  </p>
                </li>
              </ul>
            </div>
            <BaseButton variant="ghost" size="sm" @click="dismissRegulatoryAlerts">
              {{ $t('DASHBOARD.REGULATORY.DISMISS') }}
            </BaseButton>
          </div>
        </BaseCard>
      </div>

      <dl class="mt-8 grid grid-cols-3 gap-3 sm:gap-4">
        <NuxtLinkLocale
          v-for="stat in stats"
          :key="stat.label"
          :to="stat.to"
          class="rounded-xl border border-line bg-surface p-4 transition-all hover:-translate-y-0.5 hover:shadow-md sm:p-5"
        >
          <BaseIcon :name="stat.icon" :size="18" class="text-ink-faint" />
          <dd class="mt-2 font-display text-2xl text-ink sm:text-3xl">
            <BaseSkeleton v-if="pending" width="2rem" height="1.75rem" />
            <template v-else>{{ stat.value }}</template>
          </dd>
          <dt class="text-xs text-ink-muted sm:text-sm">{{ stat.label }}</dt>
        </NuxtLinkLocale>
      </dl>

      <section class="mt-12">
        <div class="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 class="font-display text-2xl text-ink">{{ $t('DASHBOARD.RECOMMENDED_TITLE') }}</h2>
            <p class="mt-1 text-sm text-ink-muted">{{ $t('DASHBOARD.RECOMMENDED_SUBTITLE') }}</p>
          </div>
          <NuxtLinkLocale
            to="/discover"
            class="shrink-0 text-sm font-medium text-ink-soft underline-offset-4 hover:text-ink hover:underline"
          >
            {{ $t('COMMON.SEE_MORE') }}
          </NuxtLinkLocale>
        </div>
        <ProductGrid
          :products="data?.recommended"
          :loading="pending"
          :skeleton-count="6"
          :columns="3"
        />
      </section>

      <section v-if="observations.length" class="mt-12">
        <h2 class="font-display text-2xl text-ink">{{ $t('DASHBOARD.ROUTINE_TITLE') }}</h2>
        <p class="mt-1 text-sm text-ink-muted">
          {{ $t('DASHBOARD.ROUTINE_SUBTITLE', { count: data?.routine?.itemCount ?? 0 }) }}
        </p>

        <ul class="mt-4 space-y-3">
          <li
            v-for="observation in observations"
            :key="observation.title.code"
            class="flex items-start gap-3 rounded-xl border border-line bg-surface p-4"
          >
            <span
              class="flex size-8 shrink-0 items-center justify-center rounded-lg"
              :class="
                observation.severity === 'notice'
                  ? 'bg-caution-soft text-caution'
                  : 'bg-surface-muted text-ink-faint'
              "
            >
              <BaseIcon :name="observation.severity === 'notice' ? 'alert' : 'info'" :size="16" />
            </span>
            <div class="min-w-0">
              <p class="text-sm font-medium text-ink">{{ localise(observation.title) }}</p>
              <p class="mt-0.5 text-sm leading-relaxed text-ink-muted">
                {{ localise(observation.detail) }}
              </p>
            </div>
          </li>
        </ul>

        <BaseButton to="/shelf" variant="secondary" size="sm" class="mt-4">
          {{ $t('DASHBOARD.OPEN_SHELF') }}
        </BaseButton>
      </section>
    </template>
  </div>
</template>
