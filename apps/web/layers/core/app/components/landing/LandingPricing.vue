<script setup lang="ts">
const { t } = useI18n();

const tiers = computed(() =>
  (['FREE', 'PREMIUM'] as const).map((key) => ({
    key,
    name: t(`LANDING.PRICING.${key}.NAME`),
    price: t(`LANDING.PRICING.${key}.PRICE`),
    cadence: key === 'FREE' ? t('LANDING.PRICING.FOREVER') : t('LANDING.PRICING.PER_MONTH'),
    description: t(`LANDING.PRICING.${key}.DESCRIPTION`),
    features: [1, 2, 3, 4].map((n) => t(`LANDING.PRICING.${key}.F_${n}`)),
    cta: { label: t(`LANDING.PRICING.${key}.CTA`), to: '/register' },
    highlighted: key === 'PREMIUM',
  })),
);
</script>

<template>
  <section class="container-page py-16 sm:py-20">
    <SectionHeading
      :eyebrow="$t('LANDING.PRICING.EYEBROW')"
      :title="$t('LANDING.PRICING.TITLE')"
      :description="$t('LANDING.PRICING.BODY')"
      align="center"
    />

    <div class="mx-auto mt-12 grid max-w-3xl gap-5 sm:grid-cols-2">
      <div
        v-for="tier in tiers"
        :key="tier.key"
        class="relative flex flex-col rounded-xl border bg-surface p-6"
        :class="tier.highlighted ? 'border-ink shadow-md' : 'border-line'"
      >
        <BaseBadge v-if="tier.highlighted" tone="blush" class="absolute -top-2.5 left-6">
          {{ $t('LANDING.PRICING.MOST_COMPLETE') }}
        </BaseBadge>

        <h3 class="font-display text-xl text-ink">{{ tier.name }}</h3>
        <p class="mt-1 text-sm text-ink-muted">{{ tier.description }}</p>

        <p class="mt-5 flex items-baseline gap-1.5">
          <span class="font-display text-3xl text-ink">{{ tier.price }}</span>
          <span class="text-sm text-ink-muted">{{ tier.cadence }}</span>
        </p>

        <ul class="mt-5 flex-1 space-y-2.5">
          <li v-for="feature in tier.features" :key="feature" class="flex items-start gap-2.5 text-sm text-ink-soft">
            <BaseIcon name="check" :size="15" class="mt-0.5 shrink-0 text-sage" />
            {{ feature }}
          </li>
        </ul>

        <BaseButton
          :to="tier.cta.to"
          :variant="tier.highlighted ? 'primary' : 'secondary'"
          block
          class="mt-6"
        >{{ tier.cta.label }}</BaseButton>
      </div>
    </div>
  </section>
</template>
