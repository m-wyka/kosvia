<script setup lang="ts">
const model = defineModel<number>({ required: true });

const props = withDefaults(
  defineProps<{
    label?: string;
    min?: number;
    max?: number;
    step?: number;
    format?: (value: number) => string;
  }>(),
  { min: 0, max: 100, step: 1 },
);

const emit = defineEmits<{ change: [value: number] }>();

const id = useId();
const percent = computed(() => ((model.value - props.min) / (props.max - props.min)) * 100);
const display = computed(() => (props.format ? props.format(model.value) : String(model.value)));
</script>

<template>
  <div class="w-full">
    <div v-if="label" class="mb-2 flex items-baseline justify-between gap-3">
      <label :for="id" class="text-sm font-medium text-ink-soft">{{ label }}</label>
      <span class="text-sm font-medium tabular-nums text-ink">{{ display }}</span>
    </div>
    <input
      :id="id"
      v-model.number="model"
      type="range"
      :min="min"
      :max="max"
      :step="step"
      class="kosvia-range h-6 w-full cursor-pointer appearance-none bg-transparent"
      :style="{ '--fill': `${percent}%` }"
      @change="emit('change', model)"
    />
  </div>
</template>

<style scoped>
@reference '@@/layers/core/app/assets/css/main.css';

.kosvia-range::-webkit-slider-runnable-track {
  @apply h-1 rounded-pill;
  @apply bg-linear-to-r from-ink from-(length:--fill) to-line-strong to-(length:--fill);
}
.kosvia-range::-moz-range-track {
  @apply h-1 rounded-pill;
  @apply bg-linear-to-r from-ink from-(length:--fill) to-line-strong to-(length:--fill);
}
.kosvia-range::-webkit-slider-thumb {
  @apply -mt-2 size-5 appearance-none rounded-pill border-2 border-ink bg-surface shadow-sm;
  @apply transition-transform duration-(--duration-fast) ease-out-soft;
}
.kosvia-range::-webkit-slider-thumb:active {
  @apply scale-112;
}
.kosvia-range::-moz-range-thumb {
  @apply size-4.5 rounded-pill border-2 border-ink bg-surface shadow-sm;
}
</style>
