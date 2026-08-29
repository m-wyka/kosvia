<script setup lang="ts">
import type { AdminStatsDto } from '@kosvia/shared';

definePageMeta({ layout: 'admin', middleware: 'admin' });

const { data, pending, error, refresh } = await useApiFetch<AdminStatsDto>('/admin/stats', {
  key: 'admin-stats',
});

const { t } = useI18n();

const cards = computed(() => [
  {
    label: t('ADMIN.NAV.PRODUCTS'),
    value: data.value?.products,
    to: '/admin/products',
    icon: 'droplet' as const,
  },
  {
    label: t('ADMIN.NAV.BRANDS'),
    value: data.value?.brands,
    to: '/admin/brands',
    icon: 'tag' as const,
  },
  {
    label: t('ADMIN.NAV.CATEGORIES'),
    value: data.value?.categories,
    to: '/admin/categories',
    icon: 'shelf' as const,
  },
  {
    label: t('ADMIN.NAV.INGREDIENTS'),
    value: data.value?.ingredients,
    to: '/admin/ingredients',
    icon: 'leaf' as const,
  },
  {
    label: t('ADMIN.NAV.STORES'),
    value: data.value?.stores,
    to: '/admin/stores',
    icon: 'store' as const,
  },
  {
    label: t('ADMIN.NAV.OFFERS'),
    value: data.value?.offers,
    to: '/admin/offers',
    icon: 'compare' as const,
  },
  {
    label: t('ADMIN.NAV.USERS'),
    value: data.value?.users,
    to: '/admin/users',
    icon: 'user' as const,
  },
  {
    label: t('ADMIN.OVERVIEW.SHELF_ITEMS'),
    value: data.value?.shelfItems,
    to: '/admin/users',
    icon: 'heart' as const,
  },
]);

useSeo(() => ({
  title: t('SEO.ADMIN.TITLE'),
  description: t('SEO.ADMIN.DESCRIPTION'),
  noindex: true,
}));
</script>

<template>
  <div>
    <AdminPageHeader
      :title="$t('ADMIN.OVERVIEW.TITLE')"
      :description="$t('ADMIN.OVERVIEW.SUBTITLE')"
    />

    <BaseErrorState v-if="error" @retry="refresh()" />

    <div v-else class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <NuxtLinkLocale
        v-for="card in cards"
        :key="card.label"
        :to="card.to"
        class="rounded-xl border border-line bg-surface p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
      >
        <BaseIcon :name="card.icon" :size="17" class="text-ink-faint" />
        <p class="mt-2.5 font-display text-2xl text-ink tabular-nums">
          <BaseSkeleton v-if="pending" width="2.5rem" height="1.75rem" />
          <template v-else>{{ card.value ?? 0 }}</template>
        </p>
        <p class="text-xs text-ink-muted">{{ card.label }}</p>
      </NuxtLinkLocale>
    </div>

    <div class="mt-8 rounded-xl border border-dashed border-line-strong bg-surface-muted p-5">
      <h2 class="text-sm font-semibold text-ink">{{ $t('ADMIN.OVERVIEW.ABOUT_TITLE') }}</h2>
      <p class="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-muted">
        {{ $t('ADMIN.OVERVIEW.ABOUT_BODY') }}
      </p>
    </div>
  </div>
</template>
