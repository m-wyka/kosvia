<script setup lang="ts">
import type { AppReviewDto } from '@kosvia/shared';

const props = defineProps<{ review: AppReviewDto }>();

const { t } = useI18n();
const format = useFormat();

const displayName = computed(() => props.review.authorName ?? t('REVIEWS.ANONYMOUS_AUTHOR'));
</script>

<template>
  <article class="flex h-full flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
    <div class="flex items-center gap-3">
      <BaseAvatar :name="displayName" :size="36" />
      <div class="min-w-0">
        <p class="truncate text-sm font-semibold text-ink">
          {{ displayName }}
        </p>
        <p class="text-xs text-ink-faint">
          {{ format.dateShort(review.createdAt) }}
        </p>
      </div>
      <ReviewStars :rating="review.rating" class="ml-auto shrink-0" />
    </div>
    <p class="text-sm leading-relaxed text-ink-muted">
      {{ review.body }}
    </p>
  </article>
</template>
