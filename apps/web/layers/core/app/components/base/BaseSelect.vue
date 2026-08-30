<script setup lang="ts" generic="T">
import Multiselect from 'vue-multiselect';

const model = defineModel<T | T[] | null>();

withDefaults(
  defineProps<{
    options: T[];
    label?: string;
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
    emptyText?: string;
  }>(),
  {
    optionLabel: 'label',
    trackBy: 'value',
    searchable: true,
    clearable: true,
  },
);

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
@reference '@@/layers/core/app/assets/css/main.css';

.kosvia-select .multiselect {
  @apply relative block min-h-11 w-full text-sm leading-normal text-ink;
}
.kosvia-select .multiselect * {
  @apply box-border;
}

.kosvia-select .multiselect__tags {
  @apply flex min-h-11 cursor-pointer flex-wrap items-center gap-1.5 py-1.5 pr-9 pl-3.5;
}

.kosvia-select .multiselect__tags-wrap {
  @apply contents;
}

.kosvia-select .multiselect__input,
.kosvia-select .multiselect__single,
.kosvia-select .multiselect__placeholder {
  @apply m-0 min-h-6 min-w-0 flex-[1_1_4rem] border-none bg-transparent p-0 leading-6;
}
.kosvia-select .multiselect__placeholder {
  @apply basis-auto;
}
.kosvia-select .multiselect--active .multiselect__placeholder {
  @apply hidden;
}

.kosvia-select .multiselect__input:focus,
.kosvia-select .multiselect__input:focus-visible {
  @apply outline-none;
}

.kosvia-select .multiselect__select {
  @apply absolute top-0 right-0 flex h-11 w-9 cursor-pointer items-center justify-center p-0;
  @apply transition-transform duration-(--duration-base) ease-out-soft;
}
.kosvia-select .multiselect--active .multiselect__select {
  @apply rotate-180;
}

.kosvia-select .multiselect__content-wrapper {
  @apply absolute top-full left-0 z-40 block w-full;
  @apply mt-1.5 overflow-x-hidden overflow-y-auto overscroll-contain;
}

.kosvia-select .multiselect--above .multiselect__content-wrapper {
  @apply top-auto bottom-full mt-0 mb-1.5;
}

.kosvia-select .multiselect__content {
  @apply m-0 w-full min-w-full list-none p-1;
}
.kosvia-select .multiselect__element {
  @apply block;
}
.kosvia-select .multiselect__option {
  @apply relative block cursor-pointer truncate;
}

.kosvia-select .multiselect__option::after {
  @apply hidden;
}

.kosvia-select .multiselect__spinner {
  @apply absolute top-px right-px block;
}

.kosvia-select .multiselect--disabled {
  @apply pointer-events-none opacity-55;
}

.kosvia-select .multiselect__tags {
  @apply rounded-lg border border-line-strong bg-surface;
  @apply transition-[border-color,box-shadow] duration-(--duration-fast);
}
.kosvia-select .multiselect__tags:hover {
  @apply border-ink-faint;
}
.kosvia-select .multiselect--active .multiselect__tags {
  @apply border-ink-faint shadow-focus;
}
.kosvia-select--error .multiselect__tags {
  @apply border-critical;
}

.kosvia-select .multiselect__input,
.kosvia-select .multiselect__single {
  @apply text-sm text-ink;
}
.kosvia-select .multiselect__placeholder,
.kosvia-select .multiselect__input::placeholder {
  @apply text-sm text-ink-faint;
}

.kosvia-select .multiselect__tag {
  @apply m-0 inline-flex items-center gap-1 rounded-pill px-2 py-0.5;
  @apply bg-blush-soft text-xs leading-normal font-medium whitespace-nowrap text-blush-deep;
}
.kosvia-select .multiselect__tag-icon {
  @apply static inline-flex size-3.5 cursor-pointer items-center justify-center;
  @apply rounded-pill not-italic;
}

.kosvia-select .multiselect__tag-icon::after {
  @apply content-['×'] text-[0.9rem] leading-none text-blush-deep;
}
.kosvia-select .multiselect__tag-icon:hover {
  @apply bg-transparent;
}
.kosvia-select .multiselect__tag-icon:hover::after {
  @apply text-critical;
}

.kosvia-select .multiselect__select::before {
  @apply content-[''] border-x-4 border-t-5 border-x-transparent border-t-ink-muted;
}

.kosvia-select .multiselect__content-wrapper {
  @apply rounded-lg border border-line bg-surface shadow-lg;
}

.kosvia-select .multiselect__option {
  @apply rounded-md px-3 py-2.5 text-sm text-ink-soft;
  @apply transition-colors duration-(--duration-fast);
}

.kosvia-select .multiselect__element + .multiselect__element {
  @apply mt-1;
}
.kosvia-select .multiselect__option--highlight {
  @apply bg-surface-muted text-ink;
}
.kosvia-select .multiselect__option--selected {
  @apply bg-blush-soft font-medium text-blush-deep;
}
.kosvia-select .multiselect__option--disabled {
  @apply cursor-not-allowed text-ink-faint;
}

.kosvia-select .multiselect__spinner {
  @apply h-10 w-9 rounded-lg bg-surface;
}
</style>
