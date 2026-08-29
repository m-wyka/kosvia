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
/* ---------------------------------------------------------------- structure --

   vue-multiselect ships a stylesheet we deliberately do not import: it would
   drag in its own colours, radii and green highlight. But that file is not only
   a skin — it is also what makes the control *work*. Without it the dropdown is
   a static block that pushes the page down, the option list is an inline-block
   narrower than its panel, and each option is an inline <span> whose padding
   does not affect line height, so the rows overlap each other.

   So the structural half lives here. Change it only if the library's markup
   changes; everything below the second divider is ours to restyle freely.      */

.kosvia-select .multiselect {
  position: relative;
  display: block;
  width: 100%;
  min-height: 2.75rem;
  color: var(--color-ink);
  font-size: 0.875rem;
}
.kosvia-select .multiselect * {
  box-sizing: border-box;
}

.kosvia-select .multiselect__tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem;
  min-height: 2.75rem;
  padding: 0.375rem 2.25rem 0.375rem 0.875rem;
  cursor: pointer;
}

/* The tags live in a wrapper span; `contents` lets them sit in the flex row. */
.kosvia-select .multiselect__tags-wrap {
  display: contents;
}

.kosvia-select .multiselect__input,
.kosvia-select .multiselect__single,
.kosvia-select .multiselect__placeholder {
  flex: 1 1 4rem;
  min-width: 0;
  margin: 0;
  padding: 0;
  min-height: 1.5rem;
  line-height: 1.5rem;
  border: none;
  background: transparent;
}
.kosvia-select .multiselect__placeholder {
  flex-basis: auto;
}
.kosvia-select .multiselect--active .multiselect__placeholder {
  display: none;
}

/* The focus ring belongs on the control, not on the bare input inside it —
   otherwise the global :focus-visible outline draws a second box within the
   first. */
.kosvia-select .multiselect__input:focus,
.kosvia-select .multiselect__input:focus-visible {
  outline: none;
}

.kosvia-select .multiselect__select {
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.75rem;
  padding: 0;
  cursor: pointer;
  transition: transform var(--duration-base) var(--ease-out-soft);
}
.kosvia-select .multiselect--active .multiselect__select {
  transform: rotate(180deg);
}

.kosvia-select .multiselect__content-wrapper {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 40;
  display: block;
  width: 100%;
  margin-top: 0.375rem;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}
/* The library flips the panel above the field when there is no room below. */
.kosvia-select .multiselect--above .multiselect__content-wrapper {
  top: auto;
  bottom: 100%;
  margin-top: 0;
  margin-bottom: 0.375rem;
}

/* The library sets `display: inline-block` on this list inline, so it cannot be
   overridden from here — `min-width` is what makes the rows fill the panel
   instead of shrink-wrapping to the longest brand name. */
.kosvia-select .multiselect__content {
  width: 100%;
  min-width: 100%;
  margin: 0;
  padding: 0.25rem;
  list-style: none;
}
.kosvia-select .multiselect__element {
  display: block;
}
.kosvia-select .multiselect__option {
  display: block;
  position: relative;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* `show-labels` is off, so this pseudo-element only ever renders empty space. */
.kosvia-select .multiselect__option::after {
  display: none;
}

.kosvia-select .multiselect__spinner {
  position: absolute;
  top: 1px;
  right: 1px;
  display: block;
}

.kosvia-select .multiselect--disabled {
  opacity: 0.55;
  pointer-events: none;
}

/* --------------------------------------------------------------------- skin --

   From here down the control is ours: it should read as a sibling of
   BaseInput, not as a third-party widget.                                     */

.kosvia-select .multiselect__tags {
  background: var(--color-surface);
  border: 1px solid var(--color-line-strong);
  border-radius: var(--radius-lg);
  transition:
    border-color var(--duration-fast),
    box-shadow var(--duration-fast);
}
.kosvia-select .multiselect__tags:hover {
  border-color: var(--color-ink-faint);
}
.kosvia-select .multiselect--active .multiselect__tags {
  border-color: var(--color-ink-faint);
  box-shadow: var(--shadow-focus);
}
.kosvia-select--error .multiselect__tags {
  border-color: var(--color-critical);
}

.kosvia-select .multiselect__input,
.kosvia-select .multiselect__single {
  font-size: 0.875rem;
  color: var(--color-ink);
}
.kosvia-select .multiselect__placeholder,
.kosvia-select .multiselect__input::placeholder {
  font-size: 0.875rem;
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
  white-space: nowrap;
}
.kosvia-select .multiselect__tag-icon {
  position: static;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 0.875rem;
  height: 0.875rem;
  border-radius: 999px;
  font-style: normal;
  cursor: pointer;
}
/* The glyph lives in the library's stylesheet, which we do not import — without
   it the remove button is an invisible 14px hit area. */
.kosvia-select .multiselect__tag-icon::after {
  content: '×';
  color: var(--color-blush-deep);
  font-size: 0.9rem;
  line-height: 1;
}
.kosvia-select .multiselect__tag-icon:hover {
  background: transparent;
}
.kosvia-select .multiselect__tag-icon:hover::after {
  color: var(--color-critical);
}

.kosvia-select .multiselect__select::before {
  content: '';
  border-style: solid;
  border-width: 5px 4px 0;
  border-color: var(--color-ink-muted) transparent transparent;
}

.kosvia-select .multiselect__content-wrapper {
  background: var(--color-surface);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
}

.kosvia-select .multiselect__option {
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  line-height: 1.25rem;
  color: var(--color-ink-soft);
  transition: background-color var(--duration-fast);
}
/* Rows carry a filled background, so two adjacent selected ones merge into a
   single blob without a gap between them. */
.kosvia-select .multiselect__element + .multiselect__element {
  margin-top: 0.25rem;
}
.kosvia-select .multiselect__option--highlight {
  background: var(--color-surface-muted);
  color: var(--color-ink);
}
.kosvia-select .multiselect__option--selected {
  background: var(--color-blush-soft);
  color: var(--color-blush-deep);
  font-weight: 500;
}
.kosvia-select .multiselect__option--disabled {
  color: var(--color-ink-faint);
  cursor: not-allowed;
}

.kosvia-select .multiselect__spinner {
  width: 2.25rem;
  height: 2.5rem;
  background: var(--color-surface);
  border-radius: var(--radius-lg);
}
</style>
