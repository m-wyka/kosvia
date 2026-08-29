<script setup lang="ts">
withDefaults(
  defineProps<{
    eyebrow: string;
    title: string;
    description: string;
    points?: string[];
    ctaLabel?: string;
    ctaTo?: string;
    reverse?: boolean;
    tone?: 'surface' | 'canvas';
  }>(),
  { tone: 'canvas' },
);
</script>

<template>
  <section :class="tone === 'surface' && 'border-y border-line bg-surface'">
    <div class="container-page grid items-center gap-10 py-16 lg:grid-cols-2 lg:gap-16 sm:py-20">
      <div :class="reverse && 'lg:order-2'">
        <SectionHeading :eyebrow="eyebrow" :title="title" :description="description" />

        <ul v-if="points?.length" class="mt-6 space-y-3">
          <li
            v-for="point in points"
            :key="point"
            class="flex items-start gap-2.5 text-sm text-ink-soft"
          >
            <span
              class="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-sage-soft text-sage"
            >
              <BaseIcon name="check" :size="12" :stroke-width="2.2" />
            </span>
            {{ point }}
          </li>
        </ul>

        <BaseButton v-if="ctaTo" :to="ctaTo" variant="secondary" class="mt-7">
          {{ ctaLabel ?? 'Learn more' }}
          <template #icon><BaseIcon name="arrow-right" :size="16" /></template>
        </BaseButton>
      </div>

      <div :class="reverse && 'lg:order-1'">
        <slot />
      </div>
    </div>
  </section>
</template>
