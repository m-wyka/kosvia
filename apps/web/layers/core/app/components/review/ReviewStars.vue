<script setup lang="ts">
const props = withDefaults(defineProps<{ rating: number; size?: number }>(), { size: 16 });

const { t } = useI18n();

const STAR_COUNT = 5;

const displayRating = computed(() => Math.round(props.rating * 10) / 10);
const fillWidth = computed(() => {
  const ratio = Math.min(Math.max(props.rating / STAR_COUNT, 0), 1);
  return `${ratio * 100}%`;
});
</script>

<template>
  <span
    class="relative inline-flex"
    role="img"
    :aria-label="t('REVIEWS.RATING_LABEL', { rating: displayRating })"
  >
    <span class="flex gap-0.5 text-ink-faint">
      <BaseIcon v-for="index in STAR_COUNT" :key="index" name="star" :size="size" />
    </span>
    <span
      class="absolute inset-y-0 left-0 flex gap-0.5 overflow-hidden text-caution"
      :style="{ width: fillWidth }"
      aria-hidden="true"
    >
      <BaseIcon v-for="index in STAR_COUNT" :key="index" name="star-filled" :size="size" />
    </span>
  </span>
</template>
