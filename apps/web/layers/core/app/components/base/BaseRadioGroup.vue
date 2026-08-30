<script setup lang="ts" generic="T extends string">
import type { LabelledOption } from '@kosvia/shared';

const model = defineModel<T | null>();

withDefaults(defineProps<{ options: LabelledOption<T>[]; label?: string; columns?: 1 | 2 | 3 }>(), {
  columns: 2,
});

const name = useId();
</script>

<template>
  <fieldset>
    <legend v-if="label" class="mb-3 text-sm font-medium text-ink-soft">{{ label }}</legend>
    <div
      class="grid gap-2.5"
      :class="{
        'sm:grid-cols-2': columns === 2,
        'sm:grid-cols-3': columns === 3,
      }"
    >
      <label
        v-for="option in options"
        :key="option.value"
        class="group relative flex cursor-pointer items-start gap-3 rounded-lg border bg-surface p-3.5 transition-all duration-fast hover:border-ink-faint has-checked:border-ink has-checked:bg-surface-muted has-checked:shadow-xs"
      >
        <input
          v-model="model"
          type="radio"
          :name="name"
          :value="option.value"
          class="peer sr-only"
        />
        <span
          class="mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-full border border-line-strong transition-colors group-has-checked:border-ink"
          aria-hidden="true"
        >
          <span
            class="size-2.5 scale-0 rounded-full bg-ink transition-transform duration-fast group-has-checked:scale-100"
          />
        </span>
        <span class="min-w-0">
          <span class="block text-sm font-medium text-ink">{{ option.label }}</span>
          <span v-if="option.description" class="mt-0.5 block text-xs text-ink-muted">
            {{ option.description }}
          </span>
        </span>
      </label>
    </div>
  </fieldset>
</template>
