<script setup lang="ts">
/**
 * The application's only toggle.
 *
 * The knob is laid out by flexbox rather than positioned absolutely: a
 * `<button>` centres its content, so an absolutely positioned knob with no
 * `left` anchor starts from the middle of the track and slides straight out
 * of it. Padding plus a translate keeps the travel derived from the track.
 */
const model = defineModel<boolean>();
defineProps<{ label?: string; hint?: string; disabled?: boolean }>();
const id = useId();
</script>

<template>
  <div class="flex items-center justify-between gap-4">
    <label v-if="label || hint" :for="id" class="min-w-0 cursor-pointer">
      <span class="block text-sm font-medium text-ink">{{ label }}</span>
      <span v-if="hint" class="block text-xs text-ink-muted">{{ hint }}</span>
    </label>
    <button
      :id="id"
      type="button"
      role="switch"
      :aria-checked="model ? 'true' : 'false'"
      :aria-label="label"
      :disabled="disabled"
      class="flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-pill border px-0.5
             transition-colors duration-[--duration-base]
             disabled:cursor-not-allowed disabled:opacity-55"
      :class="model ? 'border-ink bg-ink' : 'border-line-strong bg-canvas-deep'"
      @click="model = !model"
    >
      <!-- Track is 44px wide: 2px of border and 4px of padding leave 38px of
           room for an 18px knob, so 20px is the full travel. -->
      <span
        class="size-[18px] rounded-full bg-white shadow-xs
               transition-transform duration-[--duration-base] ease-[--ease-out-soft]"
        :class="model ? 'translate-x-5' : 'translate-x-0'"
      />
    </button>
  </div>
</template>
