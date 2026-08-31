<script setup lang="ts">
import type { AppReviewDto, AppReviewListResult } from '@kosvia/shared';

const { t } = useI18n();

const MIN_REVIEWS_FOR_MARQUEE = 4;
const MIN_CARDS_PER_ROW = 8;

const { data } = await useApiFetch<AppReviewListResult>('/app-reviews?sort=newest&pageSize=12', {
  key: 'landing-reviews',
  lazy: true,
});

const reviews = computed(() => data.value?.items ?? []);
const summary = computed(() => data.value?.summary ?? null);
const hasEnoughReviews = computed(() => reviews.value.length >= MIN_REVIEWS_FOR_MARQUEE);

const repeatToMinimum = (rowReviews: AppReviewDto[]): AppReviewDto[] => {
  if (!rowReviews.length) {
    return [];
  }
  const repeated = [...rowReviews];
  while (repeated.length < MIN_CARDS_PER_ROW) {
    repeated.push(rowReviews[repeated.length % rowReviews.length]!);
  }
  return repeated;
};

const firstRow = computed(() =>
  repeatToMinimum(reviews.value.filter((review, index) => index % 2 === 0)),
);
const secondRow = computed(() =>
  repeatToMinimum(reviews.value.filter((review, index) => index % 2 === 1)),
);
</script>

<template>
  <section v-if="hasEnoughReviews && summary" class="overflow-hidden pb-20">
    <div class="container-page">
      <SectionHeading
        align="center"
        :eyebrow="t('LANDING.REVIEWS.EYEBROW')"
        :title="t('LANDING.REVIEWS.TITLE')"
        :description="t('LANDING.REVIEWS.DESCRIPTION')"
      />
      <div v-if="summary.average !== null" class="mt-6 flex items-center justify-center gap-3">
        <span class="font-display text-3xl leading-none text-ink">
          {{ summary.average }}
        </span>
        <ReviewStars :rating="summary.average" :size="20" />
        <span class="text-sm text-ink-muted">
          {{ t('LANDING.REVIEWS.AVERAGE_LABEL', summary.count) }}
        </span>
      </div>
    </div>

    <div class="marquee-mask mt-10 space-y-4">
      <div class="marquee-row overflow-hidden">
        <div class="animate-marquee flex w-max">
          <div class="flex gap-4 pr-4">
            <ReviewCard
              v-for="(review, index) in firstRow"
              :key="`${review.id}-${index}`"
              :review="review"
              class="w-80 shrink-0"
            />
          </div>
          <div class="flex gap-4 pr-4" aria-hidden="true">
            <ReviewCard
              v-for="(review, index) in firstRow"
              :key="`duplicate-${review.id}-${index}`"
              :review="review"
              class="w-80 shrink-0"
            />
          </div>
        </div>
      </div>
      <div class="marquee-row overflow-hidden">
        <div class="animate-marquee-reverse flex w-max">
          <div class="flex gap-4 pr-4">
            <ReviewCard
              v-for="(review, index) in secondRow"
              :key="`${review.id}-${index}`"
              :review="review"
              class="w-80 shrink-0"
            />
          </div>
          <div class="flex gap-4 pr-4" aria-hidden="true">
            <ReviewCard
              v-for="(review, index) in secondRow"
              :key="`duplicate-${review.id}-${index}`"
              :review="review"
              class="w-80 shrink-0"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="mt-10 text-center">
      <BaseButton to="/reviews" variant="secondary">
        {{ t('LANDING.REVIEWS.CTA') }}
      </BaseButton>
    </div>
  </section>
</template>
