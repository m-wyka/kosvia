<script setup lang="ts" generic="T extends string | number">
const model = defineModel<T>();

const props = defineProps<{
  options: Array<{ value: T; label: string }>;
  label?: string;
  hint?: string;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}>();

const id = useId();
const describedBy = computed(
  () =>
    [props.error ? `${id}-error` : null, props.hint ? `${id}-hint` : null]
      .filter(Boolean)
      .join(' ') || undefined,
);
</script>

<template>
  <div class="w-full">
    <label v-if="label" :for="id" class="mb-1.5 block text-sm font-medium text-ink-soft">
      {{ label }}
    </label>

    <div class="relative">
      <select
        :id="id"
        v-model="model"
        :disabled="disabled"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="describedBy"
        class="w-full appearance-none rounded-lg border bg-surface pr-9 pl-3.5 text-sm text-ink transition-colors duration-fast disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-faint"
        :class="[
          error ? 'border-critical' : 'border-line-strong hover:border-ink-faint',
          size === 'sm' ? 'h-9' : 'h-11',
        ]"
      >
        <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
        <option v-for="option in options" :key="String(option.value)" :value="option.value">
          {{ option.label }}
        </option>
      </select>

      <BaseIcon
        name="chevron-down"
        :size="16"
        class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-muted"
      />
    </div>

    <p v-if="error" :id="`${id}-error`" class="mt-1.5 text-xs text-critical">{{ error }}</p>
    <p v-else-if="hint" :id="`${id}-hint`" class="mt-1.5 text-xs text-ink-muted">{{ hint }}</p>
  </div>
</template>
