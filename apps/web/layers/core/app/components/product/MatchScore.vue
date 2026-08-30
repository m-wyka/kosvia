<script setup lang="ts">
import type { MatchTier, PersonalMatchDto } from '@kosvia/shared';

const COUNT_UP_DURATION_MS = 700;

const DIMENSIONS = {
  sm: { box: 40, stroke: 3.5, text: 'text-xs' },
  md: { box: 60, stroke: 4, text: 'text-base' },
  lg: { box: 92, stroke: 5, text: 'text-2xl' },
} as const;

const TONES: Record<MatchTier, { ring: string; text: string; bg: string }> = {
  perfect: { ring: 'var(--color-sage)', text: 'text-sage', bg: 'bg-sage-soft' },
  great: { ring: 'var(--color-sage)', text: 'text-sage', bg: 'bg-sage-soft' },
  good: { ring: 'var(--color-peach)', text: 'text-peach', bg: 'bg-peach-soft' },
  fair: { ring: 'var(--color-sand)', text: 'text-ink-soft', bg: 'bg-sand-soft' },
  poor: { ring: 'var(--color-ink-faint)', text: 'text-ink-muted', bg: 'bg-surface-muted' },
};

const props = withDefaults(
  defineProps<{
    match?: PersonalMatchDto | null;
    size?: 'sm' | 'md' | 'lg';
    animate?: boolean;
    showLabel?: boolean;
  }>(),
  { size: 'md', showLabel: true },
);

const { t } = useI18n();
const vocab = useVocabulary();

const LOWEST_SHOWN_SCORE = 50;

const score = computed(() => props.match?.score ?? 0);
const showsNumber = computed(
  () => props.match?.personalised === false || score.value >= LOWEST_SHOWN_SCORE,
);
const displayed = ref(props.animate ? 0 : score.value);

const dimension = computed(() => DIMENSIONS[props.size]);
const radius = computed(() => (dimension.value.box - dimension.value.stroke) / 2);
const circumference = computed(() => 2 * Math.PI * radius.value);
const tone = computed(() => TONES[props.match?.tier ?? 'poor']);

const label = computed(() =>
  props.match?.personalised === false
    ? t('PRODUCT.FORMULA_SCORE')
    : vocab.matchTier(props.match?.tier ?? 'poor'),
);

const easeOutCubic = (progress: number): number => 1 - Math.pow(1 - progress, 3);

const prefersReducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const animateCountUp = () => {
  const startedAt = performance.now();
  const tick = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / COUNT_UP_DURATION_MS);
    displayed.value = Math.round(score.value * easeOutCubic(progress));
    if (progress < 1) {
      requestAnimationFrame(tick);
    }
  };
  requestAnimationFrame(tick);
};

onMounted(() => {
  if (!props.animate) {
    return;
  }
  if (prefersReducedMotion()) {
    displayed.value = score.value;
    return;
  }
  animateCountUp();
});

watch(score, (nextScore) => {
  if (!props.animate) {
    displayed.value = nextScore;
  }
});
</script>

<template>
  <div v-if="match" class="flex items-center gap-3">
    <div
      class="relative shrink-0"
      :style="{ width: `${dimension.box}px`, height: `${dimension.box}px` }"
    >
      <svg
        :width="dimension.box"
        :height="dimension.box"
        :viewBox="`0 0 ${dimension.box} ${dimension.box}`"
        class="-rotate-90"
        role="img"
        :aria-label="$t('PRODUCT.MATCH_ARIA', { score, tier: label })"
      >
        <circle
          :cx="dimension.box / 2"
          :cy="dimension.box / 2"
          :r="radius"
          fill="none"
          stroke="var(--color-line)"
          :stroke-width="dimension.stroke"
        />
        <circle
          :cx="dimension.box / 2"
          :cy="dimension.box / 2"
          :r="radius"
          fill="none"
          :stroke="tone.ring"
          :stroke-width="dimension.stroke"
          stroke-linecap="round"
          :stroke-dasharray="circumference"
          :stroke-dashoffset="circumference * (1 - displayed / 100)"
          class="transition-[stroke-dashoffset] duration-slow ease-out-soft"
        />
      </svg>
      <span
        class="absolute inset-0 flex items-center justify-center font-semibold tabular-nums"
        :class="[dimension.text, tone.text]"
      >
        <template v-if="showsNumber">
          {{ displayed }}
          <span class="text-[0.6em] font-medium">%</span>
        </template>
        <span v-else class="text-[0.7em] font-medium">
          {{ $t('PRODUCT.MATCH_BELOW_THRESHOLD') }}
        </span>
      </span>
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
