<script setup lang="ts">
import type { CategoryDto, DiscoveryFeedDto } from '@kosvia/shared';

const auth = useAuthStore();
const { t } = useI18n();
const vocab = useVocabulary();

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

useSeo(() => ({
  title: t('SEO.DISCOVER.TITLE'),
  description: t('SEO.DISCOVER.DESCRIPTION'),
  path: '/discover',
}));

/**
 * The API labels each section in English; we translate on the section key and
 * fall back to the API's own title for anything the frontend does not know.
 */
function sectionTitle(section: { key: string; title: string }): string {
  if (section.key === 'recommended') {
    return auth.isAuthenticated
      ? t('DISCOVER.SECTION.RECOMMENDED_PERSONAL')
      : t('DISCOVER.SECTION.RECOMMENDED_GENERIC');
  }
  if (section.key.startsWith('concern-')) {
    return t('DISCOVER.SECTION.CONCERN', {
      concern: vocab.concern(section.key.replace('concern-', '')).toLowerCase(),
    });
  }
  if (section.key === 'best-value') {
    const ceiling = /(\d+)/.exec(section.title)?.[1] ?? '50';
    return t('DISCOVER.SECTION.BEST_VALUE', { price: ceiling });
  }
  if (section.key === 'fragrance-free') return t('DISCOVER.SECTION.FRAGRANCE_FREE');
  if (section.key === 'daily-spf') return t('DISCOVER.SECTION.DAILY_SPF');
  return section.title;
}

function sectionSubtitle(section: { key: string; subtitle: string | null }): string | null {
  if (section.key === 'recommended') {
    return auth.isAuthenticated
      ? t('DISCOVER.SECTION.RECOMMENDED_SUBTITLE_PERSONAL')
      : t('DISCOVER.SECTION.RECOMMENDED_SUBTITLE_GENERIC');
  }
  if (section.key.startsWith('concern-')) return t('DISCOVER.SECTION.CONCERN_SUBTITLE');
  if (section.key === 'best-value') return t('DISCOVER.SECTION.BEST_VALUE_SUBTITLE');
  if (section.key === 'fragrance-free') return t('DISCOVER.SECTION.FRAGRANCE_FREE_SUBTITLE');
  if (section.key === 'daily-spf') return t('DISCOVER.SECTION.DAILY_SPF_SUBTITLE');
  return section.subtitle;
}
</script>

<template>
  <div class="container-page py-8 sm:py-12">
    <header class="mb-10 max-w-2xl">
      <h1 class="font-display text-3xl text-ink sm:text-4xl">{{ $t('DISCOVER.TITLE') }}</h1>
      <p class="mt-2 text-base text-ink-muted">
        {{ auth.isAuthenticated ? $t('DISCOVER.SUBTITLE_PERSONAL') : $t('DISCOVER.SUBTITLE_GENERIC') }}
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
          :title="sectionTitle(section)"
          :subtitle="sectionSubtitle(section)"
          :products="section.products"
          :see-all-to="section.key === 'daily-spf'
            ? '/products?category=sun-care'
            : section.key === 'fragrance-free'
              ? '/products?fragranceFree=true'
              : '/products?sort=best-match'"
        />
      </div>

      <section v-if="browseTiles.length" class="mt-16">
        <h2 class="font-display text-2xl text-ink">{{ $t('DISCOVER.BROWSE_TITLE') }}</h2>
        <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <NuxtLinkLocale
            v-for="category in browseTiles"
            :key="category.id"
            :to="`/products?category=${category.slug}`"
            class="group rounded-xl border border-line bg-surface p-5 transition-all
                   hover:-translate-y-0.5 hover:border-line-strong hover:shadow-md"
          >
            <p class="font-display text-lg text-ink">
              {{ vocab.category(category.slug, category.name) }}
            </p>
            <p class="mt-1 text-xs text-ink-muted">
              {{ $t('DISCOVER.PRODUCT_COUNT', category.productCount ?? 0) }}
            </p>
            <BaseIcon
              name="arrow-right"
              :size="16"
              class="mt-3 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ink"
            />
          </NuxtLinkLocale>
        </div>
      </section>

      <section class="mt-16">
        <BaseCard class="flex flex-wrap items-center justify-between gap-5 border-line-strong">
          <div class="min-w-0 max-w-lg">
            <h2 class="font-display text-xl text-ink">{{ $t('DISCOVER.CTA_TITLE') }}</h2>
            <p class="mt-1.5 text-sm text-ink-muted">{{ $t('DISCOVER.CTA_BODY') }}</p>
          </div>
          <BaseButton to="/ai" size="lg">
            <template #icon><BaseIcon name="sparkles" :size="17" /></template>
            {{ $t('DISCOVER.CTA_BUTTON') }}
          </BaseButton>
        </BaseCard>
      </section>
    </template>
  </div>
</template>
