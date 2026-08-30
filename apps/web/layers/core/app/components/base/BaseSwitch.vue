<script setup lang="ts">
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
      class="flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-pill border px-0.5 transition-colors duration-base disabled:cursor-not-allowed disabled:opacity-55"
      :class="model ? 'border-ink bg-ink' : 'border-line-strong bg-canvas-deep'"
      @click="model = !model"
    >
      <span
        class="size-4.5 rounded-full bg-white shadow-xs transition-transform duration-base ease-out-soft"
        :class="model ? 'translate-x-5' : 'translate-x-0'"
      />
    </button>
  </div>
</template>
