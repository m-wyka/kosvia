<script setup lang="ts">
import type { ProductSummaryDto } from '@kosvia/shared';

defineProps<{ featured?: ProductSummaryDto | null }>();

const format = useFormat();
</script>

<template>
  <section class="relative overflow-hidden">
    <div class="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
      <div
        class="absolute -top-32 -left-24 size-136 rounded-full bg-blush-soft blur-3xl opacity-70"
      />
      <div
        class="absolute -top-16 right-0 size-112 rounded-full bg-lavender-soft blur-3xl opacity-60"
      />
      <div class="absolute top-64 left-1/3 size-96 rounded-full bg-sage-soft blur-3xl opacity-50" />
    </div>

    <div
      class="container-page grid items-center gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-24"
    >
      <div class="animate-fade-up max-w-xl">
        <BaseBadge tone="blush">
          <template #icon><BaseIcon name="sparkles" :size="12" /></template>
          {{ $t('LANDING.BADGE') }}
        </BaseBadge>

        <h1 class="mt-5 font-display text-4xl leading-[1.08] text-ink sm:text-5xl lg:text-[3.4rem]">
          {{ $t('LANDING.HERO_TITLE') }}
        </h1>

        <p class="mt-5 text-lg leading-relaxed text-ink-soft">{{ $t('LANDING.HERO_BODY') }}</p>

        <div class="mt-8 flex flex-col gap-3 sm:flex-row">
          <BaseButton to="/onboarding" size="lg">
            {{ $t('LANDING.CTA_PRIMARY') }}
            <template #icon><BaseIcon name="arrow-right" :size="18" /></template>
          </BaseButton>
          <BaseButton to="/products" size="lg" variant="secondary">
            {{ $t('LANDING.CTA_SECONDARY') }}
          </BaseButton>
        </div>

        <dl class="mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-line pt-7">
          <div>
            <dt class="text-xs text-ink-muted">{{ $t('LANDING.STAT_PRODUCTS') }}</dt>
            <dd class="font-display text-2xl text-ink">130+</dd>
          </div>
          <div>
            <dt class="text-xs text-ink-muted">{{ $t('LANDING.STAT_INGREDIENTS') }}</dt>
            <dd class="font-display text-2xl text-ink">139</dd>
          </div>
          <div>
            <dt class="text-xs text-ink-muted">{{ $t('LANDING.STAT_STORES') }}</dt>
            <dd class="font-display text-2xl text-ink">5</dd>
          </div>
        </dl>
      </div>

      <div class="relative mx-auto w-full max-w-sm lg:max-w-none">
        <div
          class="animate-fade-up relative rounded-2xl border border-line bg-surface p-5 shadow-lg"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <p class="text-2xs font-medium tracking-wide text-ink-muted uppercase">
                {{ featured?.brand.name ?? 'Kalmé' }}
              </p>
              <p class="mt-0.5 font-display text-lg text-ink">
                {{ featured?.name ?? 'Ceramide Barrier Cream' }}
              </p>
            </div>
            <MatchScore
              :match="
                featured?.personalMatch ?? {
                  score: 92,
                  tier: 'perfect',
                  reasons: [],
                  warnings: [],
                  personalised: true,
                }
              "
              size="md"
              animate
              :show-label="false"
            />
          </div>

          <ProductImage
            :src="featured?.imageUrl ?? '/img/product/kalme-ceramide-barrier-cream.svg'"
            :alt="
              featured ? `${featured.brand.name} ${featured.name}` : $t('LANDING.HERO_CARD_ALT')
            "
            ratio="square"
            eager
            class="mt-4"
          />

          <ul class="mt-4 space-y-2 text-sm">
            <li class="flex items-start gap-2 text-ink-soft">
              <BaseIcon name="check" :size="15" class="mt-0.5 shrink-0 text-sage" />
              {{ $t('LANDING.HERO_CARD_REASON_1') }}
            </li>
            <li class="flex items-start gap-2 text-ink-soft">
              <BaseIcon name="check" :size="15" class="mt-0.5 shrink-0 text-sage" />
              {{ $t('LANDING.HERO_CARD_REASON_2') }}
            </li>
            <li class="flex items-start gap-2 text-ink-soft">
              <BaseIcon name="check" :size="15" class="mt-0.5 shrink-0 text-sage" />
              {{ $t('LANDING.HERO_CARD_REASON_3') }}
            </li>
          </ul>

          <div class="mt-5 flex items-center justify-between border-t border-line pt-4">
            <PriceDisplay
              :price="featured?.lowestPrice ?? 59.99"
              :store="featured?.lowestPriceStore ?? null"
            />
            <BaseButton size="sm" :to="featured ? `/products/${featured.slug}` : '/products'">
              {{ $t('LANDING.HERO_CARD_CTA') }}
            </BaseButton>
          </div>
        </div>

        <div
          class="absolute top-[38%] -left-6 hidden rounded-xl border border-line bg-surface px-4 py-3 shadow-lg sm:block"
        >
          <p class="text-xs text-ink-muted">{{ $t('LANDING.CHEAPER_ALTERNATIVE') }}</p>
          <p class="font-display text-lg text-ink">{{ format.price(41.99) }}</p>
        </div>
      </div>
    </div>
  </section>
</template>
