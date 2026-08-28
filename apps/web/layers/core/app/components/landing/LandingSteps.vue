<script setup lang="ts">
const steps = [
  {
    icon: 'user' as const,
    title: 'Tell us about your skin',
    body: 'Two minutes: skin type, what bothers you, what you are working towards, and what you are willing to spend.',
  },
  {
    icon: 'droplet' as const,
    title: 'We read the ingredient lists',
    body: 'Every product is broken down against our own INCI database — position by position, not by guesswork.',
  },
  {
    icon: 'sparkles' as const,
    title: 'You get a Personal Match',
    body: 'A single number per product, with the reasoning behind it written out. No black box.',
  },
  {
    icon: 'tag' as const,
    title: 'Then we find the best price',
    body: 'The same product across stores, plus cheaper alternatives that score just as well for you.',
  },
];
</script>

<template>
  <section class="container-page py-16 sm:py-20">
    <SectionHeading
      eyebrow="How it works"
      title="From “I need something” to “this is the one”"
      description="Kosvia does the part of shopping that is genuinely hard: reading the label and working out whether it suits you."
      align="center"
    />

    <ol class="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <li
        v-for="(step, index) in steps"
        :key="step.title"
        class="relative rounded-xl border border-line bg-surface p-6"
      >
        <span class="flex size-10 items-center justify-center rounded-lg bg-surface-muted text-ink">
          <BaseIcon :name="step.icon" :size="19" />
        </span>
        <p class="mt-4 text-2xs font-semibold tracking-widest text-ink-faint uppercase">
          Step {{ index + 1 }}
        </p>
        <h3 class="mt-1 text-base font-semibold text-ink">{{ step.title }}</h3>
        <p class="mt-2 text-sm leading-relaxed text-ink-muted">{{ step.body }}</p>
      </li>
    </ol>
  </section>
</template>
