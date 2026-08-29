<script setup lang="ts">
type Tone =
  | 'neutral'
  | 'blush'
  | 'sage'
  | 'lavender'
  | 'peach'
  | 'sand'
  | 'positive'
  | 'caution'
  | 'critical'
  | 'info';

withDefaults(defineProps<{ tone?: Tone; size?: 'xs' | 'sm' }>(), { tone: 'neutral', size: 'sm' });

const tones: Record<Tone, string> = {
  neutral: 'bg-surface-muted text-ink-soft border-line',
  blush: 'bg-blush-soft text-blush-deep border-blush/25',
  sage: 'bg-sage-soft text-sage border-sage/30',
  lavender: 'bg-lavender-soft text-lavender border-lavender/30',
  peach: 'bg-peach-soft text-peach border-peach/35',
  sand: 'bg-sand-soft text-ink-soft border-sand/35',
  positive: 'bg-positive-soft text-positive border-positive/25',
  caution: 'bg-caution-soft text-caution border-caution/25',
  critical: 'bg-critical-soft text-critical border-critical/25',
  info: 'bg-info-soft text-info border-info/25',
};
</script>

<template>
  <span
    class="inline-flex items-center gap-1 rounded-pill border font-medium whitespace-nowrap"
    :class="[tones[tone], size === 'xs' ? 'px-2 py-0.5 text-2xs' : 'px-2.5 py-1 text-xs']"
  >
    <slot name="icon" />
    <slot />
  </span>
</template>
