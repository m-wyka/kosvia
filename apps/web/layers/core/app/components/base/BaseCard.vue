<script setup lang="ts">
withDefaults(
  defineProps<{
    /** `raised` lifts on hover — only for cards that are themselves links. */
    variant?: 'flat' | 'raised' | 'muted';
    padded?: boolean;
    as?: string;
  }>(),
  { variant: 'flat', padded: true, as: 'div' },
);
</script>

<template>
  <component
    :is="as"
    class="rounded-xl border transition-all duration-[--duration-base] ease-[--ease-out-soft]"
    :class="[
      variant === 'muted'
        ? 'border-line bg-surface-muted'
        : 'border-line bg-surface',
      variant === 'raised' && 'shadow-xs hover:-translate-y-0.5 hover:border-line-strong hover:shadow-md',
      padded && 'p-5 sm:p-6',
    ]"
  >
    <slot />
  </component>
</template>
