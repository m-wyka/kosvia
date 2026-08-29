<script setup lang="ts">
const model = defineModel<string | null>();

const props = withDefaults(
  defineProps<{
    label?: string;
    hint?: string;
    error?: string;
    placeholder?: string;
    rows?: number;
    maxlength?: number;
    disabled?: boolean;
  }>(),
  { rows: 4 },
);

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
    <textarea
      :id="id"
      v-model="model"
      :rows="rows"
      :placeholder="placeholder"
      :maxlength="maxlength"
      :disabled="disabled"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="describedBy"
      class="w-full resize-y rounded-lg border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint transition-colors duration-[--duration-fast]"
      :class="error ? 'border-critical' : 'border-line-strong hover:border-ink-faint'"
    />
    <p v-if="error" :id="`${id}-error`" class="mt-1.5 text-xs text-critical">{{ error }}</p>
    <p v-else-if="hint" :id="`${id}-hint`" class="mt-1.5 text-xs text-ink-muted">{{ hint }}</p>
  </div>
</template>
