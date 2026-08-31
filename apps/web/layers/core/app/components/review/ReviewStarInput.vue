<script setup lang="ts">
defineProps<{ label?: string; error?: string }>();

const model = defineModel<number | null>({ default: null });

const { t } = useI18n();

const STAR_COUNT = 5;
const hoveredRating = ref<number | null>(null);

const isStarActive = (index: number): boolean => {
  return index <= (hoveredRating.value ?? model.value ?? 0);
};

const handleSelect = (index: number) => {
  model.value = index;
};
</script>

<template>
  <div>
    <span v-if="label" class="mb-1.5 block text-sm font-medium text-ink-soft">
      {{ label }}
    </span>
    <div
      class="flex gap-1"
      role="radiogroup"
      :aria-label="label || t('REVIEWS.FORM_RATING_LABEL')"
      @mouseleave="hoveredRating = null"
    >
      <button
        v-for="index in STAR_COUNT"
        :key="index"
        type="button"
        role="radio"
        :class="[
          'rounded-sm p-0.5 transition-transform duration-fast hover:scale-110',
          isStarActive(index) ? 'text-caution' : 'text-ink-faint',
        ]"
        :aria-checked="model === index"
        :aria-label="t('REVIEWS.RATING_LABEL', { rating: index })"
        @mouseenter="hoveredRating = index"
        @focus="hoveredRating = index"
        @blur="hoveredRating = null"
        @click="handleSelect(index)"
      >
        <BaseIcon :name="isStarActive(index) ? 'star-filled' : 'star'" :size="28" />
      </button>
    </div>
    <p v-if="error" class="mt-1.5 text-xs text-critical">
      {{ error }}
    </p>
  </div>
</template>
