<script setup lang="ts">
const model = defineModel<string | number | null>();

const props = withDefaults(
  defineProps<{
    label?: string;
    hint?: string;
    error?: string;
    type?: string;
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
    autocomplete?: string;
    inputmode?: 'text' | 'numeric' | 'decimal' | 'email' | 'search' | 'tel' | 'url';
  }>(),
  { type: 'text' },
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
      <span v-if="required" class="text-blush-deep" aria-hidden="true">*</span>
    </label>

    <div class="relative">
      <span
        v-if="$slots.prefix"
        class="absolute inset-y-0 left-3.5 flex items-center text-ink-faint"
      >
        <slot name="prefix" />
      </span>

      <input
        :id="id"
        v-model="model"
        :type="type"
        :placeholder="placeholder"
        :disabled="disabled"
        :required="required"
        :autocomplete="autocomplete"
        :inputmode="inputmode"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="describedBy"
        class="h-11 w-full rounded-lg border bg-surface px-3.5 text-sm text-ink placeholder:text-ink-faint transition-colors duration-fast disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-faint"
        :class="[
          error ? 'border-critical' : 'border-line-strong hover:border-ink-faint',
          $slots.prefix && 'pl-10',
          $slots.suffix && 'pr-10',
        ]"
      />

      <span
        v-if="$slots.suffix"
        class="absolute inset-y-0 right-3.5 flex items-center text-ink-faint"
      >
        <slot name="suffix" />
      </span>
    </div>

    <p v-if="error" :id="`${id}-error`" class="mt-1.5 flex items-start gap-1 text-xs text-critical">
      <BaseIcon name="alert" :size="14" class="mt-px shrink-0" />
      {{ error }}
    </p>
    <p v-else-if="hint" :id="`${id}-hint`" class="mt-1.5 text-xs text-ink-muted">{{ hint }}</p>
  </div>
</template>
