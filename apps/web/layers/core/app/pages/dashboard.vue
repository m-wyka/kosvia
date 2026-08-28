<script setup lang="ts">
import type { DashboardDto } from '@kosvia/shared';

definePageMeta({ middleware: 'auth' });

const auth = useAuthStore();
const { data, pending, error, refresh } = await useApiFetch<DashboardDto>('/dashboard', {
  key: 'dashboard',
});

const stats = computed(() => [
  { label: 'On your shelf', value: data.value?.shelfCount ?? 0, to: '/shelf', icon: 'shelf' as const },
  { label: 'Favourites', value: data.value?.favoriteCount ?? 0, to: '/shelf?tab=favorites', icon: 'heart' as const },
  { label: 'Price alerts', value: data.value?.activeAlerts ?? 0, to: '/price-alerts', icon: 'bell' as const },
]);

const observations = computed(() => data.value?.routine?.observations.slice(0, 3) ?? []);

useSeo({
  title: 'Your dashboard',
  description: 'Your matches, your shelf and your routine at a glance.',
  noindex: true,
});
</script>

<template>
  <div class="container-page py-8 sm:py-12">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="font-display text-3xl text-ink sm:text-4xl">
          Good to see you, {{ auth.displayName }}
        </h1>
        <p class="mt-2 text-sm text-ink-muted">
          {{
            data?.profile
              ? 'Everything below is ranked against your profile.'
              : 'Complete your profile and these scores become personal.'
          }}
        </p>
      </div>
      <BaseButton to="/ai" variant="secondary">
        <template #icon><BaseIcon name="sparkles" :size="16" /></template>
        Ask the AI shopper
      </BaseButton>
    </header>

    <BaseErrorState v-if="error" class="mt-8" @retry="refresh()" />

    <template v-else>
      <div v-if="!pending && !data?.profile" class="mt-8">
        <BaseCard class="flex flex-wrap items-center justify-between gap-4 border-blush/30 bg-blush-soft">
          <div class="min-w-0">
            <h2 class="font-display text-lg text-ink">Your profile is not set up yet</h2>
            <p class="mt-1 text-sm text-ink-soft">
              Two minutes of questions turns every score on the site into a personal one.
            </p>
          </div>
          <BaseButton to="/onboarding">Set up my profile</BaseButton>
        </BaseCard>
      </div>

      <dl class="mt-8 grid grid-cols-3 gap-3 sm:gap-4">
        <NuxtLink
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
        </NuxtLink>
      </dl>

      <section class="mt-12">
        <div class="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 class="font-display text-2xl text-ink">Recommended for you</h2>
            <p class="mt-1 text-sm text-ink-muted">
              Highest Personal Match, excluding what you already own.
            </p>
          </div>
          <NuxtLink
            to="/discover"
            class="shrink-0 text-sm font-medium text-ink-soft underline-offset-4 hover:text-ink hover:underline"
          >See more</NuxtLink>
        </div>
        <ProductGrid :products="data?.recommended" :loading="pending" :skeleton-count="6" :columns="3" />
      </section>

      <section v-if="observations.length" class="mt-12">
        <h2 class="font-display text-2xl text-ink">Your routine</h2>
        <p class="mt-1 text-sm text-ink-muted">
          What we notice about the {{ data?.routine?.itemCount }} products on your shelf.
        </p>

        <ul class="mt-4 space-y-3">
          <li
            v-for="observation in observations"
            :key="observation.title"
            class="flex items-start gap-3 rounded-xl border border-line bg-surface p-4"
          >
            <span
              class="flex size-8 shrink-0 items-center justify-center rounded-lg"
              :class="observation.severity === 'notice' ? 'bg-caution-soft text-caution' : 'bg-surface-muted text-ink-faint'"
            >
              <BaseIcon :name="observation.severity === 'notice' ? 'alert' : 'info'" :size="16" />
            </span>
            <div class="min-w-0">
              <p class="text-sm font-medium text-ink">{{ observation.title }}</p>
              <p class="mt-0.5 text-sm leading-relaxed text-ink-muted">{{ observation.detail }}</p>
            </div>
          </li>
        </ul>

        <BaseButton to="/shelf" variant="secondary" size="sm" class="mt-4">
          Open My Shelf
        </BaseButton>
      </section>
    </template>
  </div>
</template>
