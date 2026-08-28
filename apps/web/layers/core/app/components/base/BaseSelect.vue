<script setup lang="ts" generic="T">
import Multiselect from 'vue-multiselect';

/**
 * The application's only select.
 *
 * Wraps `vue-multiselect` so that library never appears anywhere else — if we
 * swap it out later, this file is the only one that changes. Everything else
 * uses <BaseSelect v-model :options label track-by />.
 */
const model = defineModel<T | T[] | null>();

withDefaults(
  defineProps<{
    options: T[];
    label?: string;
    /** Key on each option holding its display text. */
    optionLabel?: string;
    trackBy?: string;
    placeholder?: string;
    hint?: string;
    error?: string;
    multiple?: boolean;
    searchable?: boolean;
    clearable?: boolean;
    disabled?: boolean;
    loading?: boolean;
    /** Text shown when the search returns nothing. */
    emptyText?: string;
  }>(),
  {
    optionLabel: 'label',
    trackBy: 'value',
    searchable: true,
    clearable: true,
  },
);

/** Forwarded so callers can drive a remote search without touching the library. */
const emit = defineEmits<{
  'search-change': [query: string];
  open: [];
  close: [];
}>();

const id = useId();
</script>

<template>
  <div class="kosvia-select w-full">
    <label v-if="label" :for="id" class="mb-1.5 block text-sm font-medium text-ink-soft">
      {{ label }}
    </label>

    <Multiselect
      :id="id"
      :model-value="model as never"
      :options="options"
      :label="optionLabel"
      :track-by="trackBy"
      :multiple="multiple"
      :searchable="searchable"
      :allow-empty="clearable"
      :disabled="disabled"
      :loading="loading"
      :placeholder="placeholder ?? '—'"
      :close-on-select="!multiple"
      :clear-on-select="false"
      :preserve-search="multiple"
      :show-labels="false"
      :aria-invalid="error ? 'true' : undefined"
      :class="error && 'kosvia-select--error'"
      @update:model-value="(value: unknown) => (model = value as T | T[] | null)"
      @search-change="emit('search-change', $event)"
      @open="emit('open')"
      @close="emit('close')"
    >
      <template #noResult>
        <span class="text-sm text-ink-muted">{{ emptyText ?? $t('SEARCH.EMPTY_TITLE') }}</span>
      </template>
      <template #noOptions>
        <span class="text-sm text-ink-muted">{{ $t('ERRORS.EMPTY_TITLE') }}</span>
      </template>
    </Multiselect>

    <p v-if="error" class="mt-1.5 flex items-start gap-1 text-xs text-critical">
      <BaseIcon name="alert" :size="14" class="mt-px shrink-0" />
      {{ error }}
    </p>
    <p v-else-if="hint" class="mt-1.5 text-xs text-ink-muted">{{ hint }}</p>
  </div>
</template>

<style>
/* vue-multiselect ships its own stylesheet; we replace it entirely so the
   control matches BaseInput rather than looking like a third-party widget. */
.kosvia-select .multiselect {
  min-height: 2.75rem;
  color: var(--color-ink);
  font-size: 0.875rem;
}

.kosvia-select .multiselect__tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem;
  min-height: 2.75rem;
  padding: 0.375rem 2.25rem 0.375rem 0.875rem;
  background: var(--color-surface);
  border: 1px solid var(--color-line-strong);
  border-radius: var(--radius-lg);
  transition: border-color var(--duration-fast);
}

.kosvia-select .multiselect--active .multiselect__tags,
.kosvia-select .multiselect__tags:hover {
  border-color: var(--color-ink-faint);
}

.kosvia-select--error .multiselect__tags {
  border-color: var(--color-critical);
}

.kosvia-select .multiselect__input,
.kosvia-select .multiselect__single,
.kosvia-select .multiselect__placeholder {
  margin: 0;
  padding: 0;
  min-height: 1.5rem;
  line-height: 1.5rem;
  background: transparent;
  font-size: 0.875rem;
  color: var(--color-ink);
}

.kosvia-select .multiselect__placeholder {
  color: var(--color-ink-faint);
}

.kosvia-select .multiselect__tag {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  margin: 0;
  padding: 0.125rem 0.5rem;
  background: var(--color-blush-soft);
  color: var(--color-blush-deep);
  border-radius: var(--radius-pill);
  font-size: 0.75rem;
  font-weight: 500;
}

.kosvia-select .multiselect__tag-icon {
  position: static;
  width: 0.875rem;
  border-radius: 999px;
  line-height: 0.875rem;
}
.kosvia-select .multiselect__tag-icon::after { color: var(--color-blush-deep); font-size: 0.9rem; }
.kosvia-select .multiselect__tag-icon:hover { background: transparent; }
.kosvia-select .multiselect__tag-icon:hover::after { color: var(--color-critical); }

.kosvia-select .multiselect__select {
  height: 2.75rem;
  width: 2.25rem;
}
.kosvia-select .multiselect__select::before {
  border-color: var(--color-ink-muted) transparent transparent;
  border-width: 5px 4px 0;
}

.kosvia-select .multiselect__content-wrapper {
  margin-top: 0.375rem;
  background: var(--color-surface);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow: auto;
}

.kosvia-select .multiselect__option {
  min-height: 2.5rem;
  padding: 0.625rem 0.875rem;
  font-size: 0.875rem;
  color: var(--color-ink-soft);
}

.kosvia-select .multiselect__option--highlight,
.kosvia-select .multiselect__option--highlight::after {
  background: var(--color-surface-muted);
  color: var(--color-ink);
}

.kosvia-select .multiselect__option--selected,
.kosvia-select .multiselect__option--selected::after {
  background: var(--color-blush-soft);
  color: var(--color-blush-deep);
  font-weight: 500;
}

.kosvia-select .multiselect__spinner {
  background: var(--color-surface);
  right: 2px;
  height: 2.5rem;
}
</style>
