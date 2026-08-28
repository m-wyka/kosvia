<script setup lang="ts">
import type { PersonalMatchDto } from '@kosvia/shared';

/**
 * The Personal Match number — the single most important figure in the product,
 * so it gets a ring, a colour, and a written tier rather than colour alone.
 */
const props = withDefaults(
  defineProps<{
    match?: PersonalMatchDto | null;
    size?: 'sm' | 'md' | 'lg';
    /** Animates the ring in. Off in dense lists where it would be noise. */
    animate?: boolean;
    showLabel?: boolean;
  }>(),
  { size: 'md', showLabel: true },
);

const { t } = useI18n();
const vocab = useVocabulary();

const dimensions = {
  sm: { box: 40, stroke: 3.5, text: 'text-xs' },
  md: { box: 60, stroke: 4, text: 'text-base' },
  lg: { box: 92, stroke: 5, text: 'text-2xl' },
} as const;

const d = computed(() => dimensions[props.size]!);
const radius = computed(() => (d.value.box - d.value.stroke) / 2);
const circumference = computed(() => 2 * Math.PI * radius.value);

const score = computed(() => props.match?.score ?? 0);
const displayed = ref(props.animate ? 0 : score.value);

onMounted(() => {
  if (!props.animate) return;
  // Respect the user's motion preference — no count-up if they asked for less.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    displayed.value = score.value;
    return;
  }
  const start = performance.now();
  const duration = 700;
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    displayed.value = Math.round(score.value * (1 - Math.pow(1 - t, 3)));
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
watch(score, (next) => { if (!props.animate) displayed.value = next; });

const tone = computed(() => {
  const tier = props.match?.tier ?? 'poor';
  return {
    perfect: { ring: 'var(--color-sage)', text: 'text-sage', bg: 'bg-sage-soft' },
    great: { ring: 'var(--color-sage)', text: 'text-sage', bg: 'bg-sage-soft' },
    good: { ring: 'var(--color-peach)', text: 'text-peach', bg: 'bg-peach-soft' },
    fair: { ring: 'var(--color-sand)', text: 'text-ink-soft', bg: 'bg-sand-soft' },
    poor: { ring: 'var(--color-ink-faint)', text: 'text-ink-muted', bg: 'bg-surface-muted' },
  }[tier]!;
});

const label = computed(() =>
  props.match?.personalised === false
    ? t('PRODUCT.FORMULA_SCORE')
    : vocab.matchTier(props.match?.tier ?? 'poor'),
);
</script>

<template>
  <div v-if="match" class="flex items-center gap-3">
    <div class="relative shrink-0" :style="{ width: `${d.box}px`, height: `${d.box}px` }">
      <svg
        :width="d.box"
        :height="d.box"
        :viewBox="`0 0 ${d.box} ${d.box}`"
        class="-rotate-90"
        role="img"
        :aria-label="$t('PRODUCT.MATCH_ARIA', { score, tier: label })"
      >
        <circle
          :cx="d.box / 2" :cy="d.box / 2" :r="radius"
          fill="none" stroke="var(--color-line)" :stroke-width="d.stroke"
        />
        <circle
          :cx="d.box / 2" :cy="d.box / 2" :r="radius"
          fill="none" :stroke="tone.ring" :stroke-width="d.stroke" stroke-linecap="round"
          :stroke-dasharray="circumference"
          :stroke-dashoffset="circumference * (1 - displayed / 100)"
          class="transition-[stroke-dashoffset] duration-[--duration-slow] ease-[--ease-out-soft]"
        />
      </svg>
      <span
        class="absolute inset-0 flex items-center justify-center font-semibold tabular-nums"
        :class="[d.text, tone.text]"
      >{{ displayed }}<span class="text-[0.6em] font-medium">%</span></span>
    </div>

    <div v-if="showLabel" class="min-w-0">
      <p class="text-sm font-medium text-ink">{{ label }}</p>
      <p v-if="match.personalised === false" class="text-xs text-ink-muted">
        {{ $t('PRODUCT.COMPLETE_PROFILE') }}
      </p>
      <p v-else-if="match.reasons.length" class="truncate text-xs text-ink-muted">
        {{ match.reasons[0]!.label }}
      </p>
    </div>
  </div>
</template>
