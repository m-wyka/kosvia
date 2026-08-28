<script setup lang="ts">
const tiers = [
  {
    name: 'Free',
    price: '0 PLN',
    cadence: 'forever',
    description: 'Everything you need to choose better.',
    features: [
      'Personal Match on every product',
      'Full ingredient analysis',
      'My Shelf and routine analysis',
      'Cheaper and better alternatives',
    ],
    cta: { label: 'Create a free account', to: '/register' },
    highlighted: false,
  },
  {
    name: 'Premium',
    price: '19 PLN',
    cadence: 'per month',
    description: 'For people building a routine deliberately.',
    features: [
      'Unlimited AI Beauty Shopper',
      'Price alerts across every store',
      'Smart Basket routine budgeting',
      'Early access to new retailers',
    ],
    cta: { label: 'Coming soon', to: '/register' },
    highlighted: true,
  },
];
</script>

<template>
  <section class="container-page py-16 sm:py-20">
    <SectionHeading
      eyebrow="Premium"
      title="Free is genuinely useful. Premium is for the shortcut."
      description="The analysis is free because it should be. Premium pays for the parts that keep working while you are not looking."
      align="center"
    />

    <div class="mx-auto mt-12 grid max-w-3xl gap-5 sm:grid-cols-2">
      <div
        v-for="tier in tiers"
        :key="tier.name"
        class="relative flex flex-col rounded-xl border bg-surface p-6"
        :class="tier.highlighted ? 'border-ink shadow-md' : 'border-line'"
      >
        <BaseBadge v-if="tier.highlighted" tone="blush" class="absolute -top-2.5 left-6">
          Most complete
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
