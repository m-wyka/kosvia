<script setup lang="ts">
const model = defineModel<boolean>();
defineProps<{ label?: string; hint?: string; disabled?: boolean }>();
const id = useId();
</script>

<template>
  <label
    :for="id"
    class="flex cursor-pointer items-start gap-3 select-none"
    :class="disabled && 'cursor-not-allowed opacity-55'"
  >
    <span class="relative mt-0.5 flex size-[18px] shrink-0 items-center justify-center">
      <input
        :id="id"
        v-model="model"
        type="checkbox"
        :disabled="disabled"
        class="peer size-[18px] cursor-pointer appearance-none rounded-xs border border-line-strong bg-surface transition-all duration-[--duration-fast] checked:border-ink checked:bg-ink disabled:cursor-not-allowed"
      />
      <BaseIcon
        name="check"
        :size="12"
        class="pointer-events-none absolute text-white opacity-0 transition-opacity peer-checked:opacity-100"
      />
    </span>
    <span v-if="label || hint" class="min-w-0">
      <span class="block text-sm text-ink">{{ label }}</span>
      <span v-if="hint" class="block text-xs text-ink-muted">{{ hint }}</span>
    </span>
    <slot />
  </label>
</template>
