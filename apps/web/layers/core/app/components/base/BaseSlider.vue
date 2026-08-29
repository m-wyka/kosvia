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
.kosvia-range::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 999px;
  background: linear-gradient(
    to right,
    var(--color-ink) var(--fill),
    var(--color-line-strong) var(--fill)
  );
}
.kosvia-range::-moz-range-track {
  height: 4px;
  border-radius: 999px;
  background: linear-gradient(
    to right,
    var(--color-ink) var(--fill),
    var(--color-line-strong) var(--fill)
  );
}
.kosvia-range::-webkit-slider-thumb {
  appearance: none;
  margin-top: -8px;
  width: 20px;
  height: 20px;
  border-radius: 999px;
  background: var(--color-surface);
  border: 2px solid var(--color-ink);
  box-shadow: var(--shadow-sm);
  transition: transform var(--duration-fast) var(--ease-out-soft);
}
.kosvia-range::-webkit-slider-thumb:active {
  transform: scale(1.12);
}
.kosvia-range::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: var(--color-surface);
  border: 2px solid var(--color-ink);
  box-shadow: var(--shadow-sm);
}
</style>
