<script setup lang="ts">
import type { DiscoveryFeedDto, ProductSummaryDto } from '@kosvia/shared';

const { data: feed } = await useApiFetch<DiscoveryFeedDto>('/discover', {
  key: 'landing-feed',
  default: () => ({ sections: [] }) as DiscoveryFeedDto,
});

const highlights = computed<ProductSummaryDto[]>(
  () => feed.value?.sections.find((section) => section.key === 'recommended')?.products ?? [],
);
const featured = computed(() => highlights.value[0] ?? null);
const affordable = computed(
  () => feed.value?.sections.find((section) => section.key === 'best-value')?.products ?? [],
);

const { t } = useI18n();

useSeo(() => ({
  title: t('SEO.HOME.TITLE'),
  description: t('SEO.HOME.DESCRIPTION'),
  path: '/',
}));

const config = useRuntimeConfig();
const format = useFormat();
useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Kosvia',
        url: config.public.siteUrl,
        description: t('SEO.HOME.DESCRIPTION'),
        potentialAction: {
          '@type': 'SearchAction',
          target: `${config.public.siteUrl}/products?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      }),
    },
  ],
});
</script>

<template>
  <div>
    <LandingHero :featured="featured" />

    <LandingSteps />

    <LandingFeature
      :eyebrow="$t('LANDING.MATCH.EYEBROW')"
      :title="$t('LANDING.MATCH.TITLE')"
      :description="$t('LANDING.MATCH.BODY')"
      :points="[
        $t('LANDING.MATCH.POINT_1'),
        $t('LANDING.MATCH.POINT_2'),
        $t('LANDING.MATCH.POINT_3'),
      ]"
      :cta-label="$t('LANDING.MATCH.CTA')"
      cta-to="/products"
      tone="surface"
    >
      <LandingMatchDemo />
    </LandingFeature>

    <LandingFeature
      :eyebrow="$t('LANDING.INGREDIENTS.EYEBROW')"
      :title="$t('LANDING.INGREDIENTS.TITLE')"
      :description="$t('LANDING.INGREDIENTS.BODY')"
      :points="[
        $t('LANDING.INGREDIENTS.POINT_1'),
        $t('LANDING.INGREDIENTS.POINT_2'),
        $t('LANDING.INGREDIENTS.POINT_3'),
      ]"
      :cta-label="$t('LANDING.INGREDIENTS.CTA')"
      cta-to="/ingredients"
      reverse
    >
      <LandingIngredientDemo />
    </LandingFeature>

    <LandingFeature
      :eyebrow="$t('LANDING.ALTERNATIVES.EYEBROW')"
      :title="$t('LANDING.ALTERNATIVES.TITLE')"
      :description="$t('LANDING.ALTERNATIVES.BODY')"
      :points="[
        $t('LANDING.ALTERNATIVES.POINT_1'),
        $t('LANDING.ALTERNATIVES.POINT_2'),
        $t('LANDING.ALTERNATIVES.POINT_3'),
        $t('LANDING.ALTERNATIVES.POINT_4'),
      ]"
      tone="surface"
    >
      <LandingAlternativesDemo />
    </LandingFeature>

    <LandingFeature
      :eyebrow="$t('LANDING.SHELF.EYEBROW')"
      :title="$t('LANDING.SHELF.TITLE')"
      :description="$t('LANDING.SHELF.BODY')"
      :points="[
        $t('LANDING.SHELF.POINT_1'),
        $t('LANDING.SHELF.POINT_2'),
        $t('LANDING.SHELF.POINT_3'),
      ]"
      :cta-label="$t('LANDING.SHELF.CTA')"
      cta-to="/shelf"
      reverse
    >
      <BaseCard class="shadow-md">
        <p class="text-sm font-semibold text-ink">{{ $t('LANDING.SHELF.DEMO_TITLE') }}</p>
        <div class="mt-4 space-y-3">
          <div class="flex items-start gap-3 rounded-lg bg-surface-muted p-3.5">
            <BaseIcon name="info" :size="16" class="mt-0.5 shrink-0 text-ink-faint" />
            <p class="text-sm text-ink-soft">
              <span class="font-medium text-ink">{{ $t('LANDING.SHELF.DEMO_OVERLAP_TITLE') }}</span>
              {{ $t('LANDING.SHELF.DEMO_OVERLAP_BODY') }}
            </p>
          </div>
          <div class="flex items-start gap-3 rounded-lg bg-caution-soft p-3.5">
            <BaseIcon name="alert" :size="16" class="mt-0.5 shrink-0 text-caution" />
            <p class="text-sm text-ink-soft">
              <span class="font-medium text-ink">{{ $t('LANDING.SHELF.DEMO_GAP_TITLE') }}</span>
              {{ $t('LANDING.SHELF.DEMO_GAP_BODY') }}
            </p>
          </div>
        </div>
      </BaseCard>
    </LandingFeature>

    <LandingFeature
      :eyebrow="$t('LANDING.AI.EYEBROW')"
      :title="$t('LANDING.AI.TITLE')"
      :description="$t('LANDING.AI.BODY')"
      :points="[$t('LANDING.AI.POINT_1'), $t('LANDING.AI.POINT_2'), $t('LANDING.AI.POINT_3')]"
      :cta-label="$t('LANDING.AI.CTA')"
      cta-to="/ai"
      tone="surface"
    >
      <LandingChatDemo />
    </LandingFeature>

    <section v-if="affordable.length" class="container-page py-16 sm:py-20">
      <ProductRail
        :title="$t('LANDING.RAIL.TITLE')"
        :subtitle="$t('LANDING.RAIL.SUBTITLE')"
        :products="affordable.slice(0, 8)"
        see-all-to="/products?maxPrice=50&sort=ingredient-score"
      />
    </section>

    <LandingFeature
      :eyebrow="$t('LANDING.PRICE.EYEBROW')"
      :title="$t('LANDING.PRICE.TITLE')"
      :description="$t('LANDING.PRICE.BODY')"
      :points="[
        $t('LANDING.PRICE.POINT_1'),
        $t('LANDING.PRICE.POINT_2'),
        $t('LANDING.PRICE.POINT_3'),
      ]"
      :cta-label="$t('LANDING.PRICE.CTA')"
      cta-to="/price-alerts"
      reverse
    >
      <BaseCard :padded="false" class="overflow-hidden shadow-md">
        <div class="border-b border-line px-5 py-4">
          <p class="text-sm font-semibold text-ink">{{ $t('LANDING.PRICE.DEMO_TITLE') }}</p>
          <p class="text-xs text-ink-muted">{{ $t('LANDING.PRICE.DEMO_SUBTITLE') }}</p>
        </div>
        <ul class="divide-y divide-line">
          <li
            v-for="(offer, index) in [
              { store: 'Demo Drogeria', price: 40.99, best: true },
              { store: 'Demo Apteka', price: 44.49, best: false },
              { store: 'Demo Market', price: 47.99, best: false },
              { store: 'Demo Beauty Club', price: 52.0, best: false },
            ]"
            :key="index"
            class="flex items-center justify-between gap-3 px-5 py-3"
          >
            <span class="flex items-center gap-2 text-sm text-ink-soft">
              <BaseIcon name="store" :size="15" class="text-ink-faint" />
              {{ offer.store }}
            </span>
            <span class="flex items-center gap-2">
              <BaseBadge v-if="offer.best" tone="sage" size="xs">
                {{ $t('LANDING.PRICE.BEST_PRICE') }}
              </BaseBadge>
              <span class="text-sm font-semibold tabular-nums text-ink">
                {{ format.price(offer.price) }}
              </span>
            </span>
          </li>
        </ul>
      </BaseCard>
    </LandingFeature>

    <LandingPricing />
    <LandingFaq />
    <LandingCta />
    <LandingReviews />
  </div>
</template>
