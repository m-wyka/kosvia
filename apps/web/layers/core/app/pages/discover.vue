<script setup lang="ts">
import type { CategoryDto, DiscoveryFeedDto } from '@kosvia/shared';

const auth = useAuthStore();

const { data, pending, error, refresh } = await useApiFetch<DiscoveryFeedDto>('/discover', {
  key: 'discover-feed',
});
const { data: categories } = await useApiFetch<CategoryDto[]>('/categories', { key: 'categories' });

/** Second-level categories make the best browse tiles — "Face", not "Skincare". */
const browseTiles = computed(() =>
  (categories.value ?? [])
    .flatMap((root) => root.children ?? [])
    .flatMap((branch) => branch.children ?? [])
    .filter((leaf) => (leaf.productCount ?? 0) > 0)
    .slice(0, 8),
);

useSeo({
  title: 'Discover cosmetics chosen for you',
  description:
    'Browse cosmetics by category, concern and budget. Every product is scored against your skin, your goals and what you already own.',
  path: '/discover',
});
</script>

<template>
  <div class="container-page py-8 sm:py-12">
    <header class="mb-10 max-w-2xl">
      <h1 class="font-display text-3xl text-ink sm:text-4xl">Discover</h1>
      <p class="mt-2 text-base text-ink-muted">
        <template v-if="auth.isAuthenticated">
          Ranked against your profile — the more we know, the sharper this gets.
        </template>
        <template v-else>
          Sign in and every score below becomes a personal one.
        </template>
      </p>
    </header>

    <BaseErrorState v-if="error" @retry="refresh()" />

    <div v-else-if="pending" class="space-y-14">
      <div v-for="index in 3" :key="index">
        <BaseSkeleton width="14rem" height="1.75rem" class="mb-4" />
        <div class="flex gap-4 overflow-hidden">
          <div v-for="card in 5" :key="card" class="w-[13.5rem] shrink-0 sm:w-60">
            <ProductCardSkeleton />
          </div>
        </div>
      </div>
    </div>

    <template v-else>
      <div class="space-y-14">
        <ProductRail
          v-for="section in data?.sections"
          :key="section.key"
          :title="section.title"
          :subtitle="section.subtitle"
          :products="section.products"
          :see-all-to="section.key === 'daily-spf'
            ? '/products?category=sun-care'
            : section.key === 'fragrance-free'
              ? '/products?fragranceFree=true'
              : '/products?sort=best-match'"
        />
      </div>

      <section v-if="browseTiles.length" class="mt-16">
        <h2 class="font-display text-2xl text-ink">Browse by category</h2>
        <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <NuxtLink
            v-for="category in browseTiles"
            :key="category.id"
            :to="`/products?category=${category.slug}`"
            class="group rounded-xl border border-line bg-surface p-5 transition-all
                   hover:-translate-y-0.5 hover:border-line-strong hover:shadow-md"
          >
            <p class="font-display text-lg text-ink">{{ category.name }}</p>
            <p class="mt-1 text-xs text-ink-muted">{{ category.productCount }} products</p>
            <BaseIcon
              name="arrow-right"
              :size="16"
              class="mt-3 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ink"
            />
          </NuxtLink>
        </div>
      </section>

      <section class="mt-16">
        <BaseCard class="flex flex-wrap items-center justify-between gap-5 border-line-strong">
          <div class="min-w-0 max-w-lg">
            <h2 class="font-display text-xl text-ink">Not sure what you are looking for?</h2>
            <p class="mt-1.5 text-sm text-ink-muted">
              Describe it the way you would to a friend — “something for redness under 60 PLN” —
              and Kosvia will search its catalogue for you.
            </p>
          </div>
          <BaseButton to="/ai" size="lg">
            <template #icon><BaseIcon name="sparkles" :size="17" /></template>
            Ask the AI shopper
          </BaseButton>
        </BaseCard>
      </section>
    </template>
  </div>
</template>
