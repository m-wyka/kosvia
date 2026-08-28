<script setup lang="ts">
import type { DiscoveryFeedDto, ProductSummaryDto } from '@kosvia/shared';

/**
 * The landing page. Server-rendered, indexable, and the only page that is
 * allowed to be long — every section answers a question a first-time visitor
 * actually has.
 */
const { data: feed } = await useApiFetch<DiscoveryFeedDto>('/discover', {
  key: 'landing-feed',
  // The landing page must render even if the API is asleep.
  default: () => ({ sections: [] }) as DiscoveryFeedDto,
});

const highlights = computed<ProductSummaryDto[]>(
  () => feed.value?.sections.find((section) => section.key === 'recommended')?.products ?? [],
);
const featured = computed(() => highlights.value[0] ?? null);
const affordable = computed(
  () => feed.value?.sections.find((section) => section.key === 'best-value')?.products ?? [],
);

useSeo({
  title: 'Kosvia — your personal AI for choosing cosmetics',
  description:
    'Kosvia analyses cosmetics, their INCI ingredients, prices and your personal preferences, then tells you which product actually fits you — and where it is cheapest.',
  path: '/',
});

const config = useRuntimeConfig();
useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Kosvia',
        url: config.public.siteUrl,
        description: 'AI Beauty Shopper — find cosmetics that fit you.',
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
      eyebrow="Personalised recommendations"
      title="One number that means something"
      description="Every product carries a Personal Match: how well this specific formula fits your skin, your concerns, your budget and what is already on your shelf."
      :points="[
        'Computed on the backend, the same way every time',
        'Every point is attributed to a named reason',
        'Ask “Why?” and get the breakdown, not a black box',
      ]"
      cta-label="See it on a product"
      cta-to="/products"
      tone="surface"
    >
      <LandingMatchDemo />
    </LandingFeature>

    <LandingFeature
      eyebrow="Ingredient analysis"
      title="The label, translated"
      description="INCI lists are ordered by how much of each ingredient is in the bottle. We read them that way — grouped by what each ingredient is actually doing, with position taken seriously."
      :points="[
        '139 ingredients with plain-language descriptions',
        'Grouped into actives, hydration, soothing, base',
        'Nothing is labelled “toxic” — we describe, you decide',
      ]"
      cta-label="Browse the ingredient library"
      cta-to="/ingredients"
      reverse
    >
      <LandingIngredientDemo />
    </LandingFeature>

    <LandingFeature
      eyebrow="Alternatives"
      title="There is almost always something better"
      description="Cheaper, better matched, better value, or built from nearly the same ingredients. Alternatives come from measured overlap and real prices, never from similar-sounding names."
      :points="[
        'Cheaper — the same job for less',
        'Better match — closer to your profile',
        'Better value — the strongest match per złoty',
        'Similar ingredients — measured, not guessed',
      ]"
      tone="surface"
    >
      <LandingAlternativesDemo />
    </LandingFeature>

    <LandingFeature
      eyebrow="My Shelf"
      title="Kosvia remembers what you already own"
      description="Add what is on your bathroom shelf and recommendations change: no more suggesting a fourth cleanser, and gaps in your routine become obvious."
      :points="[
        'Spot products doing the same job',
        'See which formulas nearly duplicate each other',
        'Find the step your routine is missing',
      ]"
      cta-label="Start your shelf"
      cta-to="/shelf"
      reverse
    >
      <BaseCard class="shadow-md">
        <p class="text-sm font-semibold text-ink">Routine analysis</p>
        <div class="mt-4 space-y-3">
          <div class="flex items-start gap-3 rounded-lg bg-surface-muted p-3.5">
            <BaseIcon name="info" :size="16" class="mt-0.5 shrink-0 text-ink-faint" />
            <p class="text-sm text-ink-soft">
              <span class="font-medium text-ink">Two products doing the same job.</span>
              Both of your serums sit at the same step. Fine if you rotate them.
            </p>
          </div>
          <div class="flex items-start gap-3 rounded-lg bg-caution-soft p-3.5">
            <BaseIcon name="alert" :size="16" class="mt-0.5 shrink-0 text-caution" />
            <p class="text-sm text-ink-soft">
              <span class="font-medium text-ink">No sun protection on your shelf.</span>
              The step with the clearest long-term effect on skin.
            </p>
          </div>
        </div>
      </BaseCard>
    </LandingFeature>

    <LandingFeature
      eyebrow="AI Beauty Shopper"
      title="Ask the way you would ask a friend"
      description="“I need a moisturiser under 70 PLN for combination sensitive skin.” Kosvia searches its own catalogue first, then writes the answer around real products."
      :points="[
        'Grounded in your profile and your shelf',
        'Real products, real prices, every time',
        'Structured cards, not a wall of text',
      ]"
      cta-label="Try the AI shopper"
      cta-to="/ai"
      tone="surface"
    >
      <LandingChatDemo />
    </LandingFeature>

    <section v-if="affordable.length" class="container-page py-16 sm:py-20">
      <ProductRail
        title="Strong formulas under 50 PLN"
        subtitle="Live from the catalogue — every card scored the same way yours will be."
        :products="affordable.slice(0, 8)"
        see-all-to="/products?maxPrice=50&sort=ingredient-score"
      />
    </section>

    <LandingFeature
      eyebrow="Price comparison"
      title="Then we find where it is cheapest"
      description="The same product sits at different prices in different stores. Kosvia tracks every offer it knows about and lets you set an alert for the price you would actually pay."
      :points="[
        'Every store offer on one page',
        'Price per 100 ml, so sizes compare fairly',
        'Alerts when a product reaches your number',
      ]"
      cta-label="See price alerts"
      cta-to="/price-alerts"
      reverse
    >
      <BaseCard :padded="false" class="overflow-hidden shadow-md">
        <div class="border-b border-line px-5 py-4">
          <p class="text-sm font-semibold text-ink">Ceramide Barrier Cream · 50 ml</p>
          <p class="text-xs text-ink-muted">Across 4 stores</p>
        </div>
        <ul class="divide-y divide-line">
          <li
            v-for="(offer, index) in [
              { store: 'Demo Drogeria', price: '40,99 PLN', best: true },
              { store: 'Demo Apteka', price: '44,49 PLN', best: false },
              { store: 'Demo Market', price: '47,99 PLN', best: false },
              { store: 'Demo Beauty Club', price: '52,00 PLN', best: false },
            ]"
            :key="index"
            class="flex items-center justify-between gap-3 px-5 py-3"
          >
            <span class="flex items-center gap-2 text-sm text-ink-soft">
              <BaseIcon name="store" :size="15" class="text-ink-faint" />
              {{ offer.store }}
            </span>
            <span class="flex items-center gap-2">
              <BaseBadge v-if="offer.best" tone="sage" size="xs">Best price</BaseBadge>
              <span class="text-sm font-semibold tabular-nums text-ink">{{ offer.price }}</span>
            </span>
          </li>
        </ul>
      </BaseCard>
    </LandingFeature>

    <LandingPricing />
    <LandingFaq />
    <LandingCta />
  </div>
</template>
