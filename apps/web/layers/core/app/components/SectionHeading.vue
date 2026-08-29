<script setup lang="ts">
withDefaults(
  defineProps<{
    eyebrow?: string;
    title: string;
    description?: string;
    align?: 'left' | 'center';
    as?: string;
  }>(),
  { align: 'left', as: 'h2' },
);
</script>

<template>
  <div :class="align === 'center' && 'mx-auto max-w-2xl text-center'">
    <p
      v-if="eyebrow"
      class="mb-2.5 text-xs font-semibold tracking-[0.14em] text-blush-deep uppercase"
    >
      {{ eyebrow }}
    </p>
    <component :is="as" class="font-display text-3xl leading-[1.15] text-ink sm:text-4xl">
      {{ title }}
    </component>
    <p v-if="description" class="mt-3.5 text-base leading-relaxed text-ink-muted">
      {{ description }}
    </p>
  </div>
</template>
