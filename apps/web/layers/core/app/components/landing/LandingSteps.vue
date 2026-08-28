<script setup lang="ts">
const steps = [
  { key: 'STEP_1', icon: 'user' as const },
  { key: 'STEP_2', icon: 'droplet' as const },
  { key: 'STEP_3', icon: 'sparkles' as const },
  { key: 'STEP_4', icon: 'tag' as const },
];
</script>

<template>
  <section class="container-page py-16 sm:py-20">
    <SectionHeading
      :eyebrow="$t('LANDING.STEPS.EYEBROW')"
      :title="$t('LANDING.STEPS.TITLE')"
      :description="$t('LANDING.STEPS.BODY')"
      align="center"
    />

    <ol class="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <li
        v-for="(step, index) in steps"
        :key="step.key"
        class="relative rounded-xl border border-line bg-surface p-6"
      >
        <span class="flex size-10 items-center justify-center rounded-lg bg-surface-muted text-ink">
          <BaseIcon :name="step.icon" :size="19" />
        </span>
        <p class="mt-4 text-2xs font-semibold tracking-widest text-ink-faint uppercase">
          {{ $t('LANDING.STEPS.N', { n: index + 1 }) }}
        </p>
        <h3 class="mt-1 text-base font-semibold text-ink">
          {{ $t(`LANDING.STEPS.${step.key}.TITLE`) }}
        </h3>
        <p class="mt-2 text-sm leading-relaxed text-ink-muted">
          {{ $t(`LANDING.STEPS.${step.key}.BODY`) }}
        </p>
      </li>
    </ol>
  </section>
</template>
